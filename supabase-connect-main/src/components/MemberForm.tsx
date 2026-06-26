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
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      throw new Error("You must be signed in to manage members.");
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
      throw new Error("No church context found for the signed-in user.");
    }

    if (currentMember?.church_id && churchId && currentMember.church_id !== churchId) {
      console.error("Provided churchId does not match authenticated member church.", {
        providedChurchId: churchId,
        trustedChurchId: currentMember.church_id,
      });
    }

    return { userId: user.id, churchId: trustedChurchId };
  }, [churchId]);

  const normalizeOptional = useCallback((value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, []);

  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateFile(file, "member-photo");
    if (!validation.valid) {
      toast({ title: "Invalid photo", description: validation.error, variant: "destructive" });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }, [toast]);

  const uploadPhoto = useCallback(async (memberId: string): Promise<string | null> => {
    if (!photoFile) return null;
    const { churchId: trustedChurchId } = await getAuthenticatedContext();
    const { blob } = await optimizeImage(photoFile, "member-photo");
    const result = await uploadFile(blob, "member-photo", trustedChurchId, memberId);
    return result.publicUrl;
  }, [photoFile, getAuthenticatedContext]);

  useEffect(() => {
    setCommunityIds(selectedCommunityIds);
  }, [selectedCommunityIds]);

  useEffect(() => {
    setMinistryIds(selectedMinistryIds);
  }, [selectedMinistryIds]);

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const toggleSelection = useCallback((value: string, selectedValues: string[], setSelectedValues: React.Dispatch<React.SetStateAction<string[]>>) => {
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
        throw new Error("Full name is required.");
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
        throw new Error("Member could not be created.");
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
      toast({ title: "Member added successfully" });
      onSuccess();
    },
    onError: (err: any) => {
      console.error("Member creation failed:", err);
      toast({ title: "Error", description: err.message || "Failed to add member.", variant: "destructive" });
    },
    onSettled: () => setUploading(false),
  });

  const updateMember = useMutation({
    mutationFn: async () => {
      await getAuthenticatedContext();
      if (!member) throw new Error("No member to update");
      setUploading(true);

      const normalizedFullName = fullName.trim();
      if (!normalizedFullName) {
        throw new Error("Full name is required.");
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
      toast({ title: "Member updated successfully" });
      onSuccess();
    },
    onError: (err: any) => {
      console.error("Member update failed:", err);
      toast({ title: "Error", description: err.message || "Failed to update member.", variant: "destructive" });
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
            <UserPlus className="mr-2 h-4 w-4" /> Upload Photo
          </Button>
          <p className="text-xs text-muted-foreground mt-1">Max 500KB · JPG, PNG, WebP · Auto-optimized</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Full Name *</Label>
          <Input
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            placeholder="+255..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Birthdate</Label>
          <Input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Are you married?</Label>
          <Select value={isMarried} onValueChange={setIsMarried}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Jumuiya</Label>
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-3">
            {communities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No communities available.</p>
            ) : (
              communities.map((community: any) => (
                <label key={community.id} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={communityIds.includes(community.id)}
                    onCheckedChange={() => toggleSelection(community.id, communityIds, setCommunityIds)}
                  />
                  <span>{community.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Ministry</Label>
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-3">
            {ministries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ministries available.</p>
            ) : (
              ministries.map((ministry: any) => (
                <label key={ministry.id} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={ministryIds.includes(ministry.id)}
                    onCheckedChange={() => toggleSelection(ministry.id, ministryIds, setMinistryIds)}
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
            <p className="text-sm font-medium">Family Details</p>
            <p className="text-xs text-muted-foreground">Create the family record and optionally add spouse and other family members now.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Family Name</Label>
              <Input
                placeholder="e.g. John Family"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
              />
            </div>

            {isMarried === "yes" ? (
              <div className="space-y-2">
                <Label>Wedding Date</Label>
                <Input
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                />
              </div>
            ) : null}

            {isMarried === "yes" ? (
              <div className="space-y-2 col-span-2">
                <Label>Spouse Name</Label>
                <Input
                  placeholder="Enter spouse full name"
                  value={spouseName}
                  onChange={(e) => setSpouseName(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Other Family Members</p>
                <p className="text-xs text-muted-foreground">Add children or other household members now if you want.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>
                Add Member
              </Button>
            </div>

            {familyMembers.map((familyMember, index) => (
              <div key={index} className="grid grid-cols-2 gap-4 rounded-md border border-border p-3">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="Full name"
                    value={familyMember.full_name}
                    onChange={(e) => updateFamilyMember(index, "full_name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={familyMember.role} onValueChange={(value) => updateFamilyMember(index, "role", value as FamilyRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={familyMember.gender} onValueChange={(value) => updateFamilyMember(index, "gender", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Birthdate</Label>
                  <Input
                    type="date"
                    value={familyMember.date_of_birth}
                    onChange={(e) => updateFamilyMember(index, "date_of_birth", e.target.value)}
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFamilyMember(index)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMember.isPending || updateMember.isPending || uploading || !fullName}>
          {(uploading || createMember.isPending || updateMember.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <UserPlus className="mr-2 h-4 w-4" /> {isEdit ? "Save Changes" : "Add Member"}
        </Button>
      </div>
    </form>
  );
}
