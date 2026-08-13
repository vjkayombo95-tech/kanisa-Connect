import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearSensitiveOfflineData, readOfflineCache } from "@/lib/offline-cache";
import { captureException, logSupabaseError } from "@/lib/error-logger";
import { AuthorizationBootstrapError, classifyAuthorizationFailure, isActiveAuthorizationLoad, isTransientAuthorizationFailure, runAuthorizationOperation, safeAuthorizationDiagnostic, type AuthorizationFailureClassification } from "@/lib/authorization-bootstrap";
import { hasUnsupportedProductionRole, normalizeProductionRoles, resolveStaffMobileWorkspace, type ProductionUserRole, type StaffMobileWorkspace } from "@/lib/staff-mobile-role";

type AppRole = "super_admin" | "church_admin" | "pastor" | "secretary" | "treasurer" | "member";
type CurrentUserContext = { profile: any | null; role: AppRole | null; church_id: string | null; church: any | null; member: any | null; is_super_admin: boolean; permissions: { is_super_admin: boolean; can_view_church_workspace: boolean; can_manage_church_workspace: boolean } };
type LoadOptions = { force?: boolean; reason?: string };

interface AuthContextType { session: Session | null; user: User | null; profile: any | null; isSuperAdmin: boolean; churchId: string | null; userRole: AppRole | null; userRoles: ProductionUserRole[]; staffWorkspace: StaffMobileWorkspace | null; isLoading: boolean; authorizationError: Error | null; authorizationFailure: AuthorizationFailureClassification | null; authorizationReady: boolean; signOut: () => Promise<void>; refreshUserData: () => Promise<void> }
const AuthContext = createContext<AuthContextType>({ session:null,user:null,profile:null,isSuperAdmin:false,churchId:null,userRole:null,userRoles:[],staffWorkspace:null,isLoading:true,authorizationError:null,authorizationFailure:null,authorizationReady:false,signOut:async()=>{},refreshUserData:async()=>{} });
export const useAuth = () => useContext(AuthContext);

function diagnostic(stage: string, metadata: Record<string, unknown> = {}) {
  const safe = { stage, operation:"get_current_user_context", navigatorOnline:typeof navigator!=="undefined"?navigator.onLine:undefined, visibilityState:typeof document!=="undefined"?document.visibilityState:undefined, ...metadata };
  if (import.meta.env.DEV || import.meta.env.VITE_APP_ENV === "staging") console.info("[authorization]", safe);
  else if (stage.endsWith("FAILED") || stage === "REALTIME_CHANNEL_STATUS") console.warn("[authorization]", safe);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,setSession]=useState<Session|null>(null), [user,setUser]=useState<User|null>(null), [profile,setProfile]=useState<any|null>(null);
  const [isSuperAdmin,setIsSuperAdmin]=useState(false), [churchId,setChurchId]=useState<string|null>(null), [userRole,setUserRole]=useState<AppRole|null>(null), [isLoading,setIsLoading]=useState(true);
  const [userRoles,setUserRoles]=useState<ProductionUserRole[]>([]), [staffWorkspace,setStaffWorkspace]=useState<StaffMobileWorkspace|null>(null);
  const [authorizationError,setAuthorizationError]=useState<Error|null>(null), [authorizationFailure,setAuthorizationFailure]=useState<AuthorizationFailureClassification|null>(null), [authorizationReady,setAuthorizationReady]=useState(false);
  const sequence=useRef(0), verified=useRef(false), inFlight=useRef<{userId:string,promise:Promise<void>}|null>(null), scheduled=useRef<ReturnType<typeof setTimeout>|null>(null);
  const currentUser=useRef<User|null>(null);
  useEffect(()=>{currentUser.current=user},[user]);

  const shouldAutoNavigate=useCallback(()=>["/","/login","/onboarding"].includes(typeof window!=="undefined"?window.location.pathname:"/"),[]);
  const redirectTo=useCallback((path:string)=>{if(typeof window!=="undefined"&&window.location.pathname!==path)window.location.replace(path)},[]);
  const clearAuthorization=useCallback(()=>{setProfile(null);setIsSuperAdmin(false);setChurchId(null);setUserRole(null);setUserRoles([]);setStaffWorkspace(null);setAuthorizationReady(false);verified.current=false},[]);
  const resetUserData=useCallback(()=>{sequence.current+=1;inFlight.current=null;if(scheduled.current)clearTimeout(scheduled.current);scheduled.current=null;clearSensitiveOfflineData();setSession(null);setUser(null);clearAuthorization();setAuthorizationError(null);setAuthorizationFailure(null);setIsLoading(false)},[clearAuthorization]);
  const invalidRefresh=useCallback((e:unknown)=>/invalid refresh token|refresh token not found/.test(String((e as {message?:string})?.message||"").toLowerCase()),[]);
  const expiredLogin=useCallback(()=>{if(typeof window!=="undefined"&&window.location.pathname!=="/login"){const redirect=encodeURIComponent(window.location.pathname+window.location.search);window.location.replace(`/login?reason=session_expired&redirect=${redirect}`)}},[]);

  const performLoad=useCallback(async(target:User|null,options:LoadOptions={})=>{
    const loadSequence=++sequence.current, attemptId=crypto.randomUUID();
    if(!target){resetUserData();return}
    if(!verified.current){setIsLoading(true);setAuthorizationError(null);setAuthorizationFailure(null);setAuthorizationReady(false)}
    try{
      const cacheKey=`offline-cache:auth-context:${target.id}`; const cached=readOfflineCache<any|null>(cacheKey,null);
      if(cached&&!verified.current){setProfile(cached.profile);setIsSuperAdmin(cached.isSuperAdmin);setChurchId(cached.churchId);setUserRole(cached.userRole);setUserRoles(cached.userRoles??[]);setStaffWorkspace(cached.staffWorkspace??null)}
      const authorization=await runAuthorizationOperation(async(signal)=>{const {data,error}=await supabase.rpc("get_current_user_context" as never).abortSignal(signal);if(error)throw error;const contextData=data as unknown as CurrentUserContext|null;if(!contextData)return {contextData:null,roles:[] as ProductionUserRole[]};const superAdmin=!!contextData.is_super_admin||contextData.profile?.role==="super_admin";if(superAdmin)return {contextData,roles:["super_admin"] as ProductionUserRole[]};if(!contextData.church_id)return {contextData,roles:normalizeProductionRoles([contextData.role??"member"])};const {data:roleRows,error:roleError}=await supabase.from("user_roles").select("role, church_id").eq("user_id",target.id).eq("church_id",contextData.church_id).abortSignal(signal);if(roleError)throw roleError;const assignedRoles=(roleRows??[]).map((row)=>row.role);if(hasUnsupportedProductionRole(assignedRoles))throw new AuthorizationBootstrapError("An assigned role is not supported by this production client.","INVALID_CONTEXT");return {contextData,roles:normalizeProductionRoles([...assignedRoles,contextData.role??"member"])}},{onAttempt:e=>diagnostic(e.phase==="started"?"CONTEXT_RPC_STARTED":e.phase==="succeeded"?"CONTEXT_RPC_OK":"CONTEXT_RPC_FAILED",{bootstrapAttemptId:attemptId,loadSequence,retryAttempt:e.attempt,durationMs:e.durationMs,classification:e.classification,reason:options.reason})});
      const contextData=authorization.contextData;
      if(!contextData)throw new AuthorizationBootstrapError("Authoritative context was empty.","INVALID_CONTEXT");
      if(!isActiveAuthorizationLoad(loadSequence,sequence.current)){diagnostic("AUTHORIZATION_READY",{loadSequence,staleResultIgnored:true});return}
      const nextProfile=contextData.profile, nextSuper=!!contextData.is_super_admin||nextProfile?.role==="super_admin", nextChurch=contextData.church_id??null, nextWorkspace=resolveStaffMobileWorkspace(authorization.roles,nextSuper);
      if(!nextWorkspace)throw new AuthorizationBootstrapError("Current-church roles could not be resolved safely.","INVALID_CONTEXT");
      const nextRole=(nextSuper?"super_admin":nextWorkspace==="admin"?(authorization.roles.includes("church_admin")?"church_admin":"secretary"):nextWorkspace==="pastoral"?"pastor":nextWorkspace==="finance"?"treasurer":"member") as AppRole;
      setProfile(nextProfile);setIsSuperAdmin(nextSuper);setChurchId(nextChurch);setUserRole(nextRole);setUserRoles(authorization.roles);setStaffWorkspace(nextWorkspace);setAuthorizationError(null);setAuthorizationFailure(null);setAuthorizationReady(true);verified.current=true;
      localStorage.setItem(cacheKey,JSON.stringify({profile:nextProfile,isSuperAdmin:nextSuper,churchId:nextChurch,userRole:nextRole,userRoles:authorization.roles,staffWorkspace:nextWorkspace})); diagnostic("AUTHORIZATION_READY",{loadSequence,staleResultIgnored:false,roleCount:authorization.roles.length,staffWorkspace:nextWorkspace});
      if(shouldAutoNavigate()){if(nextWorkspace==="super_admin")redirectTo("/super-admin");else if(["admin","pastoral","finance"].includes(nextWorkspace))redirectTo("/church-admin");else if(nextChurch)redirectTo("/portal")}
    }catch(error){const classification=classifyAuthorizationFailure(error);if(!isActiveAuthorizationLoad(loadSequence,sequence.current)){diagnostic("AUTHORIZATION_FAILED",{loadSequence,classification,staleResultIgnored:true});return}
      diagnostic("AUTHORIZATION_FAILED",{loadSequence,staleResultIgnored:false,...safeAuthorizationDiagnostic(error)});captureException(error,{page:"Authentication",component:"AuthProvider",function:"loadUserData",user_id:target.id,metadata:{classification}});
      if(verified.current&&isTransientAuthorizationFailure(classification)){setAuthorizationError(null);setAuthorizationFailure(classification);setAuthorizationReady(true)}else{clearAuthorization();setAuthorizationError(error instanceof Error?error:new Error("Authorization failed"));setAuthorizationFailure(classification)}
    }finally{if(isActiveAuthorizationLoad(loadSequence,sequence.current))setIsLoading(false)}
  },[clearAuthorization,redirectTo,resetUserData,shouldAutoNavigate]);

  const loadUserData=useCallback((target:User|null,options:LoadOptions={})=>{if(target&&!options.force&&inFlight.current?.userId===target.id)return inFlight.current.promise;const promise=performLoad(target,options);if(target){inFlight.current={userId:target.id,promise};void promise.finally(()=>{if(inFlight.current?.promise===promise)inFlight.current=null})}return promise},[performLoad]);
  const scheduleRefresh=useCallback((reason:string)=>{const target=currentUser.current;if(!target)return;if(scheduled.current)clearTimeout(scheduled.current);scheduled.current=setTimeout(()=>{scheduled.current=null;void loadUserData(target,{reason})},100)},[loadUserData]);

  useEffect(()=>{diagnostic("AUTH_SESSION_STARTED");const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{setSession(next);setUser(next?.user??null);if(next?.user&&!verified.current)setIsLoading(true);setTimeout(()=>void loadUserData(next?.user??null,{reason:event}),0)});
    void supabase.auth.getSession().then(async({data:{session:existing},error})=>{if(error){diagnostic("AUTH_SESSION_FAILED",safeAuthorizationDiagnostic(error));if(invalidRefresh(error)){logSupabaseError(error,{page:"Authentication",component:"AuthProvider",function:"restoreSession",operation:"auth.getSession"});await supabase.auth.signOut({scope:"local"});resetUserData();expiredLogin();return}resetUserData();return}diagnostic("AUTH_SESSION_OK",{hasSession:!!existing});setSession(existing);setUser(existing?.user??null);void loadUserData(existing?.user??null,{reason:"INITIAL_SESSION"})}).catch(error=>{diagnostic("AUTH_SESSION_FAILED",safeAuthorizationDiagnostic(error));resetUserData()});return()=>subscription.unsubscribe()},[expiredLogin,invalidRefresh,loadUserData,resetUserData]);

  useEffect(()=>{const focus=()=>{if(document.visibilityState==="visible")scheduleRefresh("FOCUS_VISIBILITY")},online=()=>scheduleRefresh("ONLINE");window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);window.addEventListener("online",online);return()=>{window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus);window.removeEventListener("online",online)}},[scheduleRefresh]);
  useEffect(()=>{if(!user)return;let active=true;diagnostic("REALTIME_AUTH_STARTED");void supabase.realtime.setAuth().then(()=>{if(!active)return;diagnostic("REALTIME_AUTH_OK")}).catch(error=>{if(!active)return;diagnostic("REALTIME_AUTH_FAILED",safeAuthorizationDiagnostic(error));scheduleRefresh("REALTIME_AUTH_FAILED")});const channel=supabase.channel(`authorization:${user.id}`).on("postgres_changes",{event:"*",schema:"public",table:"profiles",filter:`id=eq.${user.id}`},()=>scheduleRefresh("REALTIME_PROFILE")).on("postgres_changes",{event:"*",schema:"public",table:"user_roles",filter:`user_id=eq.${user.id}`},()=>scheduleRefresh("REALTIME_ROLE")).subscribe(status=>{diagnostic("REALTIME_CHANNEL_STATUS",{status});if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status))scheduleRefresh(`REALTIME_${status}`)});return()=>{active=false;void supabase.removeChannel(channel)}},[scheduleRefresh,user]);

  const signOut=async()=>{sequence.current+=1;await supabase.auth.signOut();resetUserData()};
  const refreshUserData=async()=>{if(user){setIsLoading(true);await loadUserData(user,{force:true,reason:"RETRY"})}};
  return <AuthContext.Provider value={{session,user,profile,isSuperAdmin,churchId,userRole,userRoles,staffWorkspace,isLoading,authorizationError,authorizationFailure,authorizationReady,signOut,refreshUserData}}>{children}</AuthContext.Provider>;
}
