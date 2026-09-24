import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Loader2, X, User } from "lucide-react";
import { validateFile, optimizeImage, uploadFile } from "@/lib/file-upload";
import { useTranslation } from "react-i18next";
import { translateSystemLabel } from "@/lib/localization";

type FamilyRole = "father" | "mother" | "child" | "guardian" | "other";

interface PendingFamilyMember {
  full_name: string;
  gender: string;
  date_of_birth: string;
  role: FamilyRole;
}

interface MemberFormProps {
  isEdit: boolean;
  member?: any;
  churchId: string;
  communities: any[];
  ministries: any[];
  selectedCommunityIds?: string[];
  selectedMinistryIds?: string[];
  onSuccess: () => void;
  onCancel: () => void;
}

interface AuthenticatedContext {
  userId: string;
  churchId: string;
}

const selectionSignature = (ids: string[]) => [...ids].sort().join("\u001f");

export function MemberForm({
  isEdit,
  member,
  churchId,
  communities,
  ministries,
  selectedCommunityIds = [],
  selectedMinistryIds = [],
  onSuccess,
  onCancel,
}: MemberFormProps) {
  const [fullName, setFullName] = useState(member?.full_name || "");
  const [email, setEmail] = useState(member?.email || "");
  const [phone, setPhone] = useState(member?.phone || "");
  const [gender, setGender] = useState(member?.gender || "");
  const [dateOfBirth, setDateOfBirth] = useState(member?.date_of_birth || "");
  const [isMarried, setIsMarried] = useState("no");
  const [familyName, setFamilyName] = useState("");
  const [spouseName, setSpouseName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [familyMembers, setFamilyMembers] = useState<PendingFamilyMember[]>([]);
  const [communityIds, setCommunityIds] = useState<string[]>(selectedCommunityIds);
  const [ministryIds, setMinistryIds] = useState<string[]>(selectedMinistryIds);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(member?.photo_url || null);
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const formRecordKey = `${isEdit ? member?.id || "edit:new" : "create"}:${churchId}`;
  const selectionSyncRef = useRef({
    recordKey: formRecordKey,
    communitySignature: selectionSignature(selectedCommunityIds),
    ministrySignature: selectionSignature(selectedMinistryIds),
    communityDirty: false,
    ministryDirty: false,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const label = useCallback((key: string, fallback: string, options?: Record<string, unknown>) => {
    const translationKey = `member_form.${key}`;
    const translated = t(translationKey, { defaultValue: fallback, ...options });
    return translated === translationKey ? fallback : translated;
  }, [t]);

  const displayGender = useCallback((value: string) =>
    translateSystemLabel(t, `members_admin.gender.${value}`, value.replace(/_/g, " ")), [t]);

  const displayFamilyRole = useCallback((value: FamilyRole) =>
    translateSystemLabel(t, `members_admin.family_roles.${value}`, value.replace(/_/g, " ")), [t]);

  const getAuthenticatedContext = useCallback(async (): Promise<AuthenticatedContext> => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Failed to get authenticated user:", authError);
      throw authError;
    }

    if (!user) {
      throw new Error(label("errors.sign_in_required", "You must be signed in to manage members."));
    }

    const { data: currentMember, error: memberError } = await supabase
      .from("members")
      .select("church_id")
      .eq("user_id", user.id)
      .eq("church_id", churchId)
      .limit(1)
      .maybeSingle();

    if (memberError) {
      console.error("Failed to resolve member church context:", memberError);
      throw memberError;
    }

    const trustedChurchId = currentMember?.church_id || churchId;

    if (!trustedChurchId) {
      throw new Error(label("errors.no_church_context", "No church context found for the signed-in user."));
    }

    if (currentMember?.church_id && churchId && currentMember.church_id !== churchId) {
      console.error("Provided churchId does not match authenticated member church.", {
        providedChurchId: churchId,
        trustedChurchId: currentMember.church_id,
      });
    }

    return { userId: user.id, churchId: trustedChurchId };
  }, [churchId, label]);

  const normalizeOptional = useCallback((value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, []);

  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateFile(file, "member-photo");
    if (!validation.valid) {
      toast({
        title: label("toasts.invalid_photo", "Invalid photo"),
        description: validation.error || label("errors.invalid_photo", "Please choose a valid photo."),
        variant: "destructive",
      });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }, [label, toast]);

  const uploadPhoto = useCallback(async (memberId: string): Promise<string | null> => {
    if (!photoFile) return null;
    const { churchId: trustedChurchId } = await getAuthenticatedContext();
    const { blob } = await optimizeImage(photoFile, "member-photo");
    const result = await uploadFile(blob, "member-photo", trustedChurchId, memberId);
    return result.publicUrl;
  }, [photoFile, getAuthenticatedContext]);

  useEffect(() => {
    const nextCommunitySignature = selectionSignature(selectedCommunityIds);
    const nextMinistrySignature = selectionSignature(selectedMinistryIds);
    const syncState = selectionSyncRef.current;
    const recordChanged = syncState.recordKey !== formRecordKey;

    if (recordChanged || (!syncState.communityDirty && syncState.communitySignature !== nextCommunitySignature)) {
      setCommunityIds(selectedCommunityIds);
      syncState.communitySignature = nextCommunitySignature;
      syncState.communityDirty = false;
    }

    if (recordChanged || (!syncState.ministryDirty && syncState.ministrySignature !== nextMinistrySignature)) {
      setMinistryIds(selectedMinistryIds);
      syncState.ministrySignature = nextMinistrySignature;
      syncState.ministryDirty = false;
    }

    if (recordChanged) {
      syncState.recordKey = formRecordKey;
    }
  }, [formRecordKey, selectedCommunityIds, selectedMinistryIds]);

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const toggleSelection = useCallback((
    value: string,
    selectedValues: string[],
    setSelectedValues: React.Dispatch<React.SetStateAction<string[]>>,
    dirtyKey: "communityDirty" | "ministryDirty",
  ) => {
    selectionSyncRef.current[dirtyKey] = true;
    setSelectedValues((current) => {
      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }

      return [...current, value];
    });
  }, []);

  const addFamilyMember = useCallback(() => {
    setFamilyMembers((current) => [
      ...current,
      { full_name: "", gender: "", date_of_birth: "", role: "child" },
    ]);
  }, []);

  const updateFamilyMember = useCallback(
    <K extends keyof PendingFamilyMember>(index: number, key: K, value: PendingFamilyMember[K]) => {
      setFamilyMembers((current) =>
        current.map((member, memberIndex) =>
          memberIndex === index ? { ...member, [key]: value } : member,
        ),
      );
    },
    [],
  );

  const removeFamilyMember = useCallback((index: number) => {
    setFamilyMembers((current) => current.filter((_, memberIndex) => memberIndex !== index));
  }, []);

  const getPrimaryFamilyRole = useCallback((): FamilyRole => {
    if (gender === "male") return "father";
    if (gender === "female") return "mother";
    return "guardian";
  }, [gender]);

  const getSpouseFamilyRole = useCallback((): FamilyRole => {
    if (gender === "male") return "mother";
    if (gender === "female") return "father";
    return "guardian";
  }, [gender]);

  const createMember = useMutation({
    mutationFn: async () => {
      const { churchId: trustedChurchId } = await getAuthenticatedContext();
      setUploading(true);

      const normalizedFullName = fullName.trim();
      if (!normalizedFullName) {
        throw new Error(label("errors.full_name_required", "Full name is required."));
      }

      const validAdditionalMembers = familyMembers.filter((familyMember) => familyMember.full_name.trim().length > 0);

      const { data: createResult, error } = await supabase.rpc("create_member_with_relations" as never, {
        p_church_id: trustedChurchId,
        p_full_name: normalizedFullName,
        p_email: normalizeOptional(email),
        p_phone: normalizeOptional(phone),
        p_gender: normalizeOptional(gender),
        p_date_of_birth: normalizeOptional(dateOfBirth),
        p_is_married: isMarried === "yes",
        p_family_name: normalizeOptional(familyName),
        p_spouse_name: normalizeOptional(spouseName),
        p_wedding_date: normalizeOptional(weddingDate),
        p_primary_family_role: getPrimaryFamilyRole(),
        p_spouse_family_role: getSpouseFamilyRole(),
        p_family_members: validAdditionalMembers.map((familyMember) => ({
          full_name: familyMember.full_name.trim(),
          gender: normalizeOptional(familyMember.gender),
          date_of_birth: normalizeOptional(familyMember.date_of_birth),
          role: familyMember.role,
        })),
        p_community_ids: communityIds,
        p_ministry_ids: ministryIds,
      } as never);

      if (error) {
        console.error("Failed to create member:", error);
        throw error;
      }

      const newMemberId = (createResult as { member_id?: string } | null)?.member_id;

      if (!newMemberId) {
        throw new Error(label("errors.create_missing_id", "Member could not be created."));
      }

      // Upload photo if provided
      if (photoFile) {
        const photoUrl = await uploadPhoto(newMemberId);
        if (photoUrl) {
          const { error: photoUpdateError } = await supabase
            .from("members")
            .update({ photo_url: photoUrl })
            .eq("id", newMemberId);

          if (photoUpdateError) {
            console.error("Failed to update member photo:", photoUpdateError);
            throw photoUpdateError;
          }
        }
      }

      return { id: newMemberId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["my-member-record"] });
      queryClient.invalidateQueries({ queryKey: ["community-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["ministry-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["community-members-all"] });
      queryClient.invalidateQueries({ queryKey: ["ministry-members-all"] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.invalidateQueries({ queryKey: ["families-list"] });
      queryClient.invalidateQueries({ queryKey: ["family-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["ministries"] });
      toast({ title: label("toasts.member_added", "Member added successfully") });
      onSuccess();
    },
    onError: (err: any) => {
      console.error("Member creation failed:", err);
      toast({ title: label("toasts.error_title", "Error"), description: err.message || label("toasts.add_failed", "Failed to add member."), variant: "destructive" });
    },
    onSettled: () => setUploading(false),
  });

  const updateMember = useMutation({
    mutationFn: async () => {
      await getAuthenticatedContext();
      if (!member) throw new Error(label("errors.no_member_to_update", "No member to update"));
      setUploading(true);

      const normalizedFullName = fullName.trim();
      if (!normalizedFullName) {
        throw new Error(label("errors.full_name_required", "Full name is required."));
      }

      // Update basic info
      const { error: updateError } = await supabase.from("members").update({
        full_name: normalizedFullName,
        email: normalizeOptional(email),
        phone: normalizeOptional(phone),
        gender: normalizeOptional(gender),
        date_of_birth: normalizeOptional(dateOfBirth),
      }).eq("id", member.id);

      if (updateError) {
        console.error("Failed to update member:", updateError);
        throw updateError;
      }

      // Upload new photo if provided
      if (photoFile) {
        const photoUrl = await uploadPhoto(member.id);
        if (photoUrl) {
          const { error: photoUpdateError } = await supabase
            .from("members")
            .update({ photo_url: photoUrl })
            .eq("id", member.id);

          if (photoUpdateError) {
            console.error("Failed to update member photo:", photoUpdateError);
            throw photoUpdateError;
          }
        }
      }

      // Update community membership
      const { error: clearCommunityError } = await supabase.from("member_communities").delete().eq("member_id", member.id);
      if (clearCommunityError) {
        console.error("Failed to clear community memberships:", clearCommunityError);
        throw clearCommunityError;
      }

      if (communityIds.length > 0) {
        const { error: communityInsertError } = await supabase.from("member_communities").insert(
          communityIds.map((communityId) => ({
            community_id: communityId,
            member_id: member.id,
          })),
        );
        if (communityInsertError) {
          console.error("Failed to update community memberships:", communityInsertError);
          throw communityInsertError;
        }
      }

      // Update ministry membership
      const { error: clearMinistryError } = await supabase.from("member_ministries").delete().eq("member_id", member.id);
      if (clearMinistryError) {
        console.error("Failed to clear ministry memberships:", clearMinistryError);
        throw clearMinistryError;
      }

      if (ministryIds.length > 0) {
        const { error: ministryInsertError } = await supabase.from("member_ministries").insert(
          ministryIds.map((ministryId) => ({
            ministry_id: ministryId,
            member_id: member.id,
          })),
        );
        if (ministryInsertError) {
          console.error("Failed to update ministry memberships:", ministryInsertError);
          throw ministryInsertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["my-member-record"] });
      queryClient.invalidateQueries({ queryKey: ["community-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["ministry-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["community-members-all"] });
      queryClient.invalidateQueries({ queryKey: ["ministry-members-all"] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["ministries"] });
      toast({ title: label("toasts.member_updated", "Member updated successfully") });
      onSuccess();
    },
    onError: (err: any) => {
      console.error("Member update failed:", err);
      toast({ title: label("toasts.error_title", "Error"), description: err.message || label("toasts.update_failed", "Failed to update member."), variant: "destructive" });
    },
    onSettled: () => setUploading(false),
  });

  const resetForm = useCallback(() => {
    setFullName("");
    setEmail("");
    setPhone("");
    setGender("");
    setDateOfBirth("");
    setIsMarried("no");
    setFamilyName("");
    setSpouseName("");
    setWeddingDate("");
    setFamilyMembers([]);
    setCommunityIds([]);
    setMinistryIds([]);
    setPhotoFile(null);
    setPhotoPreview(null);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      updateMember.mutate();
    } else {
      createMember.mutate();
    }
  }, [isEdit, updateMember, createMember]);

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} className="h-20 w-20 rounded-full object-cover border border-border" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-1 -right-1 h-5 w-5"
                onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                aria-label={label("photo.remove", "Remove photo")}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="h-20 w-20 rounded-full border-2 border-dashed border-border flex items-center justify-center">
              <User className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
        </div>
        <div>
          <input
            ref={photoRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handlePhotoSelect}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => photoRef.current?.click()}
          >
            <UserPlus className="mr-2 h-4 w-4" /> {label("photo.upload", "Upload Photo")}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">{label("photo.help", "Max 500KB - JPG, PNG, WebP - Auto-optimized")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{label("fields.full_name", "Full Name")} *</Label>
          <Input
            placeholder={label("placeholders.full_name", "John Doe")}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-label={label("fields.full_name", "Full Name")}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>{label("fields.email", "Email")}</Label>
          <Input
            type="email"
            placeholder={label("placeholders.email", "john@example.com")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label={label("fields.email", "Email")}
          />
        </div>
        <div className="space-y-2">
          <Label>{label("fields.phone", "Phone")}</Label>
          <Input
            placeholder={label("placeholders.phone", "+255...")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-label={label("fields.phone", "Phone")}
          />
        </div>
        <div className="space-y-2">
          <Label>{label("fields.gender", "Gender")}</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger>
              <SelectValue placeholder={label("placeholders.select", "Select")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">{displayGender("male")}</SelectItem>
              <SelectItem value="female">{displayGender("female")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{label("fields.birthdate", "Birthdate")}</Label>
          <Input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            aria-label={label("fields.birthdate", "Birthdate")}
          />
        </div>
        <div className="space-y-2">
          <Label>{label("fields.married", "Are you married?")}</Label>
          <Select value={isMarried} onValueChange={setIsMarried}>
            <SelectTrigger>
              <SelectValue placeholder={label("placeholders.select", "Select")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">{label("options.no", "No")}</SelectItem>
              <SelectItem value="yes">{label("options.yes", "Yes")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{label("fields.communities", "Jumuiya")}</Label>
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-3">
            {communities.length === 0 ? (
              <p className="text-sm text-muted-foreground">{label("empty.communities", "No communities available.")}</p>
            ) : (
              communities.map((community: any) => (
                <label key={community.id} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={communityIds.includes(community.id)}
                    onCheckedChange={() => toggleSelection(community.id, communityIds, setCommunityIds, "communityDirty")}
                  />
                  <span>{community.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label>{label("fields.ministries", "Ministry")}</Label>
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-3">
            {ministries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{label("empty.ministries", "No ministries available.")}</p>
            ) : (
              ministries.map((ministry: any) => (
                <label key={ministry.id} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={ministryIds.includes(ministry.id)}
                    onCheckedChange={() => toggleSelection(ministry.id, ministryIds, setMinistryIds, "ministryDirty")}
                  />
                  <span>{ministry.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      {(isMarried === "yes" || familyMembers.length > 0) && !isEdit ? (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium">{label("family.title", "Family Details")}</p>
            <p className="text-xs text-muted-foreground">{label("family.description", "Create the family record and optionally add spouse and other family members now.")}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{label("fields.family_name", "Family Name")}</Label>
              <Input
                placeholder={label("placeholders.family_name", "e.g. John Family")}
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                aria-label={label("fields.family_name", "Family Name")}
              />
            </div>

            {isMarried === "yes" ? (
              <div className="space-y-2">
                <Label>{label("fields.wedding_date", "Wedding Date")}</Label>
                <Input
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                  aria-label={label("fields.wedding_date", "Wedding Date")}
                />
              </div>
            ) : null}

            {isMarried === "yes" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>{label("fields.spouse_name", "Spouse Name")}</Label>
                <Input
                  placeholder={label("placeholders.spouse_name", "Enter spouse full name")}
                  value={spouseName}
                  onChange={(e) => setSpouseName(e.target.value)}
                  aria-label={label("fields.spouse_name", "Spouse Name")}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{label("family.other_members", "Other Family Members")}</p>
                <p className="text-xs text-muted-foreground">{label("family.other_members_help", "Add children or other household members now if you want.")}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>
                {label("actions.add_family_member", "Add Member")}
              </Button>
            </div>

            {familyMembers.map((familyMember, index) => (
              <div key={index} className="grid grid-cols-1 gap-4 rounded-md border border-border p-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{label("fields.name", "Name")}</Label>
                  <Input
                    placeholder={label("placeholders.family_member_name", "Full name")}
                    value={familyMember.full_name}
                    onChange={(e) => updateFamilyMember(index, "full_name", e.target.value)}
                    aria-label={label("fields.name", "Name")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{label("fields.role", "Role")}</Label>
                  <Select value={familyMember.role} onValueChange={(value) => updateFamilyMember(index, "role", value as FamilyRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="child">{displayFamilyRole("child")}</SelectItem>
                      <SelectItem value="guardian">{displayFamilyRole("guardian")}</SelectItem>
                      <SelectItem value="other">{displayFamilyRole("other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{label("fields.gender", "Gender")}</Label>
                  <Select value={familyMember.gender} onValueChange={(value) => updateFamilyMember(index, "gender", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={label("placeholders.select", "Select")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{displayGender("male")}</SelectItem>
                      <SelectItem value="female">{displayGender("female")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{label("fields.birthdate", "Birthdate")}</Label>
                  <Input
                    type="date"
                    value={familyMember.date_of_birth}
                    onChange={(e) => updateFamilyMember(index, "date_of_birth", e.target.value)}
                    aria-label={label("fields.birthdate", "Birthdate")}
                  />
                </div>
                <div className="flex justify-end sm:col-span-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFamilyMember(index)}>
                    {label("actions.remove_family_member", "Remove")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          {label("actions.cancel", "Cancel")}
        </Button>
        <Button type="submit" disabled={createMember.isPending || updateMember.isPending || uploading || !fullName}>
          {(uploading || createMember.isPending || updateMember.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <UserPlus className="mr-2 h-4 w-4" /> {isEdit ? label("actions.save_changes", "Save Changes") : label("actions.add_member", "Add Member")}
        </Button>
      </div>
    </form>
  );
}
