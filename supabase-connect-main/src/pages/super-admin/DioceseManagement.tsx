import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Edit,
  Loader2,
  Plus,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  buildDeactivateParishPatch,
  buildDeactivateStaffPatch,
  describeParishAssignment,
  DIOCESE_SLUG_PATTERN,
  DIOCESE_STAFF_ROLES,
  DIOCESE_STAFF_STATUSES,
  DIOCESE_STATUSES,
  getActiveAssignment,
  isParishAlreadyActiveElsewhere,
  isValidDioceseRole,
  makeDioceseSlug,
  type DioceseStaffRole,
  type DioceseStaffStatus,
  type DioceseStatus,
} from "@/lib/diocese-management";

type Diocese = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: DioceseStatus;
  created_at: string;
  updated_at: string;
};

type DioceseChurch = {
  id: string;
  diocese_id: string;
  church_id: string;
  status: "active" | "inactive" | "ended";
  joined_at: string;
  ended_at: string | null;
};

type DioceseStaff = {
  id: string;
  diocese_id: string;
  user_id: string;
  role: DioceseStaffRole;
  status: DioceseStaffStatus;
  created_at: string;
};

type Church = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
};

type DirectoryUser = {
  user_id: string;
  full_name: string | null;
  email: string | null;
};

type DioceseFormState = {
  name: string;
  slug: string;
  description: string;
  status: DioceseStatus;
};

type StaffFormState = {
  userId: string;
  role: DioceseStaffRole;
};

const emptyDioceseForm: DioceseFormState = {
  name: "",
  slug: "",
  description: "",
  status: "active",
};

function getDioceseFormState(initial?: Diocese | null): DioceseFormState {
  return initial ? {
    name: initial.name,
    slug: initial.slug,
    description: initial.description ?? "",
    status: initial.status,
  } : emptyDioceseForm;
}

function statusBadgeClass(status: string) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "archived" || status === "revoked" || status === "ended") return "border-slate-200 bg-slate-50 text-slate-600";
  if (status === "suspended") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function roleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function validateDioceseForm(form: DioceseFormState) {
  const name = form.name.trim();
  const slug = form.slug.trim();

  if (!name) return "Name is required.";
  if (!slug) return "Slug is required.";
  if (!DIOCESE_SLUG_PATTERN.test(slug)) return "Slug may use lowercase letters, numbers, and single hyphens.";
  if (!DIOCESE_STATUSES.includes(form.status)) return "Choose a valid status.";
  return null;
}

function useDioceseData(dioceseId?: string) {
  const dioceses = useQuery({
    queryKey: ["sa-dioceses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dioceses")
        .select("id,name,slug,description,status,created_at,updated_at")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Diocese[];
    },
  });

  const churches = useQuery({
    queryKey: ["sa-diocese-churches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("churches")
        .select("id,name,slug,status")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Church[];
    },
  });

  const assignments = useQuery({
    queryKey: ["sa-diocese-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diocese_churches")
        .select("id,diocese_id,church_id,status,joined_at,ended_at")
        .order("joined_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DioceseChurch[];
    },
  });

  const staff = useQuery({
    queryKey: ["sa-diocese-staff", dioceseId],
    enabled: Boolean(dioceseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diocese_staff")
        .select("id,diocese_id,user_id,role,status,created_at")
        .eq("diocese_id", dioceseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DioceseStaff[];
    },
  });

  const directory = useQuery({
    queryKey: ["sa-diocese-user-directory"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_super_admin_user_directory", {
        _search: "",
        _limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as DirectoryUser[];
    },
  });

  return { dioceses, churches, assignments, staff, directory };
}

function LoadingRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell colSpan={columns}>
            <Skeleton className="h-9 w-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function DioceseDialog({
  open,
  initial,
  isSaving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  initial?: Diocese | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: DioceseFormState) => void;
}) {
  const [form, setForm] = useState<DioceseFormState>(emptyDioceseForm);
  const [manualSlug, setManualSlug] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(getDioceseFormState(initial));
    setManualSlug(Boolean(initial));
    setError(null);
  }, [open, initial]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setForm(getDioceseFormState(initial));
      setManualSlug(Boolean(initial));
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const updateName = (name: string) => {
    setForm((current) => ({
      ...current,
      name,
      slug: manualSlug ? current.slug : makeDioceseSlug(name),
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const validation = validateDioceseForm(form);
    if (validation) {
      setError(validation);
      return;
    }
    onSubmit({ ...form, name: form.name.trim(), slug: form.slug.trim(), description: form.description.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Diocese" : "Add Diocese"}</DialogTitle>
          <DialogDescription>Use the Diocese name people recognize. The slug is generated from the name.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="space-y-2">
            <Label htmlFor="diocese-name">Name</Label>
            <Input id="diocese-name" value={form.name} onChange={(event) => updateName(event.target.value)} placeholder="Archdiocese of Example" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="diocese-slug">Slug</Label>
            <Input
              id="diocese-slug"
              value={form.slug}
              onChange={(event) => {
                setManualSlug(true);
                setForm((current) => ({ ...current, slug: event.target.value.toLowerCase().trim() }));
              }}
              placeholder="archdiocese-of-example"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="diocese-status">Status</Label>
            <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as DioceseStatus }))}>
              <SelectTrigger id="diocese-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIOCESE_STATUSES.map((status) => <SelectItem key={status} value={status}>{roleLabel(status)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="diocese-description">Description</Label>
            <Textarea id="diocese-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{initial ? "Save Diocese" : "Create Diocese"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DioceseManagement() {
  const { dioceseId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedChurchId, setSelectedChurchId] = useState("");
  const [staffForm, setStaffForm] = useState<StaffFormState>({ userId: "", role: "diocese_staff" });
  const { dioceses, churches, assignments, staff, directory } = useDioceseData(dioceseId);

  const selectedDiocese = useMemo(
    () => dioceses.data?.find((diocese) => diocese.id === dioceseId) ?? null,
    [dioceses.data, dioceseId],
  );

  const activeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const assignment of assignments.data ?? []) {
      if (assignment.status === "active") counts.set(assignment.diocese_id, (counts.get(assignment.diocese_id) ?? 0) + 1);
    }
    return counts;
  }, [assignments.data]);

  const detailAssignments = useMemo(
    () => (assignments.data ?? []).filter((assignment) => assignment.diocese_id === dioceseId),
    [assignments.data, dioceseId],
  );

  const userById = useMemo(() => {
    const users = new Map<string, DirectoryUser>();
    for (const user of directory.data ?? []) users.set(user.user_id, user);
    return users;
  }, [directory.data]);

  const invalidateDioceseData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sa-dioceses"] }),
      queryClient.invalidateQueries({ queryKey: ["sa-diocese-assignments"] }),
      queryClient.invalidateQueries({ queryKey: ["sa-diocese-staff", dioceseId] }),
      queryClient.invalidateQueries({ queryKey: ["sa-diocese-user-directory"] }),
    ]);
  };

  const createDiocese = useMutation({
    mutationFn: async (form: DioceseFormState) => {
      const { error } = await supabase.from("dioceses").insert({
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setCreateOpen(false);
      await invalidateDioceseData();
      toast.success("Diocese created.");
    },
    onError: (error) => toast.error(normalizeError(error, "Unable to create Diocese.")),
  });

  const updateDiocese = useMutation({
    mutationFn: async (form: DioceseFormState) => {
      if (!selectedDiocese) throw new Error("Choose a Diocese first.");
      const { error } = await supabase
        .from("dioceses")
        .update({
          name: form.name,
          slug: form.slug,
          description: form.description || null,
          status: form.status,
        })
        .eq("id", selectedDiocese.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditOpen(false);
      await invalidateDioceseData();
      toast.success("Diocese updated.");
    },
    onError: (error) => toast.error(normalizeError(error, "Unable to update Diocese.")),
  });

  const assignParish = useMutation({
    mutationFn: async (churchId: string) => {
      if (!dioceseId) throw new Error("Choose a Diocese first.");
      if (!churchId) throw new Error("Choose a parish.");
      if (isParishAlreadyActiveElsewhere(assignments.data ?? [], churchId, dioceseId)) {
        throw new Error("This parish already belongs to another active Diocese. Remove that assignment first.");
      }
      if (getActiveAssignment(assignments.data ?? [], churchId)?.diocese_id === dioceseId) {
        throw new Error("This parish is already assigned to this Diocese.");
      }
      const { error } = await supabase.from("diocese_churches").insert({
        diocese_id: dioceseId,
        church_id: churchId,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setSelectedChurchId("");
      await invalidateDioceseData();
      toast.success("Parish assigned.");
    },
    onError: (error) => toast.error(normalizeError(error, "Unable to assign parish.")),
  });

  const removeParish = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("diocese_churches").update(buildDeactivateParishPatch()).eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateDioceseData();
      toast.success("Parish removed from Diocese.");
    },
    onError: (error) => toast.error(normalizeError(error, "Unable to remove parish.")),
  });

  const addStaff = useMutation({
    mutationFn: async (form: StaffFormState) => {
      if (!dioceseId) throw new Error("Choose a Diocese first.");
      if (!form.userId) throw new Error("Choose a user.");
      if (!isValidDioceseRole(form.role)) throw new Error("Choose a supported Diocese staff role.");
      const { error } = await supabase.from("diocese_staff").insert({
        diocese_id: dioceseId,
        user_id: form.userId,
        role: form.role,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setStaffForm({ userId: "", role: "diocese_staff" });
      await invalidateDioceseData();
      toast.success("Diocese staff added.");
    },
    onError: (error) => toast.error(normalizeError(error, "Unable to add Diocese staff.")),
  });

  const updateStaff = useMutation({
    mutationFn: async ({ staffId, role, status }: { staffId: string; role: DioceseStaffRole; status: DioceseStaffStatus }) => {
      if (!isValidDioceseRole(role)) throw new Error("Choose a supported Diocese staff role.");
      const { error } = await supabase.from("diocese_staff").update({ role, status }).eq("id", staffId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateDioceseData();
      toast.success("Diocese staff updated.");
    },
    onError: (error) => toast.error(normalizeError(error, "Unable to update Diocese staff.")),
  });

  const removeStaff = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase.from("diocese_staff").update(buildDeactivateStaffPatch()).eq("id", staffId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateDioceseData();
      toast.success("Diocese staff removed.");
    },
    onError: (error) => toast.error(normalizeError(error, "Unable to remove Diocese staff.")),
  });

  const hasError = dioceses.error || churches.error || assignments.error || staff.error || directory.error;
  const isLoading = dioceses.isLoading || assignments.isLoading || churches.isLoading;

  if (dioceseId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" className="mb-2 px-0 text-muted-foreground" onClick={() => navigate("/super-admin/dioceses")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Dioceses
            </Button>
            <h1 className="text-2xl font-bold font-serif">{selectedDiocese?.name ?? "Diocese"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage Diocese details, parishes, and staff.</p>
          </div>
          <Button onClick={() => setEditOpen(true)} disabled={!selectedDiocese}><Edit className="mr-2 h-4 w-4" /> Edit Diocese</Button>
        </div>

        {hasError ? <Alert variant="destructive"><AlertDescription>Unable to load Diocese management data.</AlertDescription></Alert> : null}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
          </div>
        ) : selectedDiocese ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader><CardContent><Badge variant="outline" className={statusBadgeClass(selectedDiocese.status)}>{roleLabel(selectedDiocese.status)}</Badge></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Active Parishes</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{activeCounts.get(selectedDiocese.id) ?? 0}</p></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Staff</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{staff.data?.filter((item) => item.status === "active").length ?? 0}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Parishes</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Assign existing parishes without changing parish roles.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={selectedChurchId} onValueChange={setSelectedChurchId}>
                    <SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Choose a parish" /></SelectTrigger>
                    <SelectContent>
                      {(churches.data ?? []).map((church) => {
                        const assignmentText = describeParishAssignment(church, assignments.data ?? [], dioceses.data ?? []);
                        const disabled = assignmentText !== "Not assigned";
                        return (
                          <SelectItem key={church.id} value={church.id} disabled={disabled}>
                            {church.name} - {assignmentText}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => assignParish.mutate(selectedChurchId)} disabled={assignParish.isPending || !selectedChurchId}>
                    <Plus className="mr-2 h-4 w-4" /> Assign
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Parish</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {assignments.isLoading ? <LoadingRows columns={4} /> : detailAssignments.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No parish has been assigned to this Diocese yet.</TableCell></TableRow>
                    ) : detailAssignments.map((assignment) => {
                      const church = churches.data?.find((item) => item.id === assignment.church_id);
                      return (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">{church?.name ?? "Parish"}</TableCell>
                          <TableCell><Badge variant="outline" className={statusBadgeClass(assignment.status)}>{roleLabel(assignment.status)}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{new Date(assignment.joined_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" disabled={assignment.status !== "active" || removeParish.isPending} onClick={() => removeParish.mutate(assignment.id)}>
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Staff</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Diocese staff are separate from parish staff and parish admins.</p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                  <Select value={staffForm.userId} onValueChange={(userId) => setStaffForm((current) => ({ ...current, userId }))}>
                    <SelectTrigger><SelectValue placeholder="Choose an existing user" /></SelectTrigger>
                    <SelectContent>
                      {(directory.data ?? []).map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.full_name || user.email || "Unnamed user"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={staffForm.role} onValueChange={(role) => setStaffForm((current) => ({ ...current, role: role as DioceseStaffRole }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DIOCESE_STAFF_ROLES.map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button onClick={() => addStaff.mutate(staffForm)} disabled={addStaff.isPending || !staffForm.userId}>
                    <UserPlus className="mr-2 h-4 w-4" /> Add Staff
                  </Button>
                </div>

                <Table>
                  <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {staff.isLoading ? <LoadingRows columns={4} /> : (staff.data ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No Diocese staff have been added yet.</TableCell></TableRow>
                    ) : (staff.data ?? []).map((staffMember) => {
                      const user = userById.get(staffMember.user_id);
                      return (
                        <TableRow key={staffMember.id}>
                          <TableCell>
                            <p className="font-medium">{user?.full_name || user?.email || "User"}</p>
                            <p className="text-xs text-muted-foreground">{user?.email ?? "User lookup unavailable"}</p>
                          </TableCell>
                          <TableCell>
                            <Select value={staffMember.role} onValueChange={(role) => updateStaff.mutate({ staffId: staffMember.id, role: role as DioceseStaffRole, status: staffMember.status })}>
                              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                              <SelectContent>{DIOCESE_STAFF_ROLES.map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={staffMember.status} onValueChange={(status) => updateStaff.mutate({ staffId: staffMember.id, role: staffMember.role, status: status as DioceseStaffStatus })}>
                              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                              <SelectContent>{DIOCESE_STAFF_STATUSES.map((status) => <SelectItem key={status} value={status}>{roleLabel(status)}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" disabled={staffMember.status === "revoked" || removeStaff.isPending} onClick={() => removeStaff.mutate(staffMember.id)}>
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Diocese not found.</CardContent></Card>
        )}

        <DioceseDialog open={editOpen} initial={selectedDiocese} isSaving={updateDiocese.isPending} onOpenChange={setEditOpen} onSubmit={(form) => updateDiocese.mutate(form)} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif">Dioceses</h1>
          <p className="mt-1 text-sm text-muted-foreground">{dioceses.data?.length ?? 0} Dioceses on Kanisa Connect</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Diocese</Button>
      </div>

      {hasError ? <Alert variant="destructive"><AlertDescription>Unable to load Dioceses.</AlertDescription></Alert> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Diocese</TableHead><TableHead>Parishes</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <LoadingRows columns={4} /> : (dioceses.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-14 text-center">
                    <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                    <p className="font-medium">No Diocese has been added yet.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Add the first Diocese when the platform is ready to organize parishes above the parish level.</p>
                  </TableCell>
                </TableRow>
              ) : (dioceses.data ?? []).map((diocese) => (
                <TableRow key={diocese.id}>
                  <TableCell>
                    <p className="font-medium">{diocese.name}</p>
                    <p className="text-xs text-muted-foreground">{diocese.slug}</p>
                  </TableCell>
                  <TableCell>{activeCounts.get(diocese.id) ?? 0} Parishes</TableCell>
                  <TableCell><Badge variant="outline" className={statusBadgeClass(diocese.status)}>{roleLabel(diocese.status)}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm"><Link to={`/super-admin/dioceses/${diocese.id}`}>Open</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DioceseDialog open={createOpen} initial={null} isSaving={createDiocese.isPending} onOpenChange={setCreateOpen} onSubmit={(form) => createDiocese.mutate(form)} />
    </div>
  );
}
