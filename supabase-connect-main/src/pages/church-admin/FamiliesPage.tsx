
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Heart,
  Users,
  Loader2,
  HandCoins,
  UserPlus,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatTZS } from "@/lib/currency";
import { translateSystemLabel } from "@/lib/localization";

const FAMILY_ROLES = ["father", "mother", "child", "guardian", "other"] as const;

export default function FamiliesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailFamily, setDetailFamily] = useState<any>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<any>(null);
  const [familyPendingDelete, setFamilyPendingDelete] = useState<any>(null);
  const [name, setName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("other");

  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const label = (
    key: string,
    fallback: string,
    options?: Record<string, unknown>
  ) => {
    const translationKey = `families_admin.${key}`;
    const translated = t(translationKey, {
      defaultValue: fallback,
      ...options,
    });

    return translated === translationKey ? fallback : translated;
  };

  const displayFamilyRole = (role: string | null | undefined) =>
    role
      ? translateSystemLabel(
          t,
          `members_admin.family_roles.${role}`,
          role.replace(/_/g, " ")
        )
      : "";

  // Load only families belonging to the current church.
  const { data: families = [], isLoading } = useQuery({
    queryKey: ["families", churchId],
    queryFn: async () => {
      if (!churchId) return [];

      const { data, error } = await supabase
        .from("families")
        .select("*")
        .eq("church_id", churchId)
        .order("name");

      if (error) {
        console.error("Error fetching families:", error);
        return [];
      }

      return data ?? [];
    },
    enabled: !!churchId,
  });

  const { data: familyMembers = [] } = useQuery({
    queryKey: ["family-members-all", churchId],
    queryFn: async () => {
      if (!churchId) return [];

      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, family_id, family_role, church_id")
        .eq("church_id", churchId)
        .not("family_id", "is", null);

      if (error) {
        console.error("Error fetching family members:", error);
        return [];
      }

      return data ?? [];
    },
    enabled: !!churchId,
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ["members-for-families", churchId],
    queryFn: async () => {
      if (!churchId) return [];

      const { data } = await supabase
        .from("members")
        .select("id, full_name")
        .eq("church_id", churchId)
        .eq("status", "active")
        .order("full_name");

      return data ?? [];
    },
    enabled: !!churchId,
  });

  const { data: contributions = [] } = useQuery({
    queryKey: ["contributions-for-families", churchId],
    queryFn: async () => {
      if (!churchId) return [];

      const { data } = await supabase
        .from("contributions")
        .select("member_id, amount")
        .eq("church_id", churchId);

      return data ?? [];
    },
    enabled: !!churchId,
  });

  const getFamilyMembersList = (familyId: string) =>
    familyMembers.filter((fm: any) => fm.family_id === familyId);

  const getFamilyTotal = (familyId: string) => {
    const memberIds = getFamilyMembersList(familyId).map(
      (fm: any) => fm.id
    );

    return contributions
      .filter((c: any) => memberIds.includes(c.member_id))
      .reduce(
        (sum: number, c: any) => sum + (c.amount || 0),
        0
      );
  };

  // Members already assigned to a family.
  const membersInFamilies = new Set(
    familyMembers.map((fm: any) => fm.id)
  );

  const availableMembers = allMembers.filter(
    (member: any) => !membersInFamilies.has(member.id)
  );

  const refreshFamilyQueries = () => {
    queryClient.invalidateQueries({
      queryKey: ["families", churchId],
    });

    queryClient.invalidateQueries({
      queryKey: ["family-members-all", churchId],
    });

    queryClient.invalidateQueries({
      queryKey: ["members-for-families", churchId],
    });
  };

  // Create a family within the current church.
  const create = useMutation({
    mutationFn: async () => {
      if (!churchId) {
        throw new Error(
          label("errors.missing_data", "Missing church context")
        );
      }

      const familyName = name.trim();

      if (!familyName) {
        throw new Error(
          label(
            "fields.family_name_required",
            "Family name is required"
          )
        );
      }

      const { error } = await supabase
        .from("families")
        .insert({
          name: familyName,
          church_id: churchId,
        });

      if (error) throw error;
    },

    onSuccess: () => {
      refreshFamilyQueries();

      toast({
        title: label("toasts.family_added", "Family added"),
      });

      setDialogOpen(false);
      setName("");
      setWeddingDate("");
    },

    onError: (err: any) =>
      toast({
        title: label("toasts.error_title", "Error"),
        description: err.message,
        variant: "destructive",
      }),
  });

  // Assign a member only to a family in the current church.
  const addFamilyMember = useMutation({
    mutationFn: async () => {
      if (
        !churchId ||
        !detailFamily ||
        !selectedMemberId ||
        detailFamily.church_id !== churchId
      ) {
        throw new Error(
          label(
            "errors.missing_data",
            "Missing or invalid family context"
          )
        );
      }

      if (
        !availableMembers.some(
          (member: any) => member.id === selectedMemberId
        )
      ) {
        throw new Error(
          label("errors.missing_data", "Invalid member selection")
        );
      }

      const { data, error } = await supabase
        .from("members")
        .update({
          family_id: detailFamily.id,
          family_role: selectedRole,
        })
        .eq("id", selectedMemberId)
        .eq("church_id", churchId)
        .is("family_id", null)
        .select("id");

      if (error) throw error;

      if (!data?.length) {
        throw new Error(
          label(
            "errors.missing_data",
            "Member could not be assigned"
          )
        );
      }
    },

    onSuccess: () => {
      refreshFamilyQueries();

      toast({
        title: label(
          "toasts.member_added",
          "Member added to family"
        ),
      });

      setAddMemberOpen(false);
      setSelectedMemberId("");
      setSelectedRole("other");
    },

    onError: (err: any) =>
      toast({
        title: label("toasts.error_title", "Error"),
        description: err.message,
        variant: "destructive",
      }),
  });

  // Remove a member only from the selected church family.
  const removeFamilyMember = useMutation({
    mutationFn: async (id: string) => {
      if (
        !churchId ||
        !detailFamily ||
        detailFamily.church_id !== churchId
      ) {
        throw new Error(
          label(
            "errors.missing_data",
            "Missing or invalid family context"
          )
        );
      }

      const { data, error } = await supabase
        .from("members")
        .update({
          family_id: null,
          family_role: null,
        })
        .eq("id", id)
        .eq("church_id", churchId)
        .eq("family_id", detailFamily.id)
        .select("id");

      if (error) throw error;

      if (!data?.length) {
        throw new Error(
          label(
            "errors.missing_data",
            "Member could not be removed from this family"
          )
        );
      }
    },

    onSuccess: () => {
      refreshFamilyQueries();

      toast({
        title: label(
          "toasts.member_removed",
          "Member removed from family"
        ),
      });

      setMemberPendingRemoval(null);
    },

    onError: (err: any) =>
      toast({
        title: label("toasts.error_title", "Error"),
        description: err.message,
        variant: "destructive",
      }),
  });

  const deleteFamily = useMutation({
    mutationFn: async (family: any) => {
      if (!churchId || !family || family.church_id !== churchId) {
        throw new Error(
          label(
            "errors.missing_data",
            "Missing or invalid family context"
          )
        );
      }

      if (getFamilyMembersList(family.id).length > 0) {
        throw new Error(
          label(
            "errors.delete_nonempty_family",
            "Remove all members before deleting this family"
          )
        );
      }

      const { data, error } = await supabase
        .from("families")
        .delete()
        .eq("id", family.id)
        .eq("church_id", churchId)
        .select("id");

      if (error) throw error;

      if (!data?.length) {
        throw new Error(
          label(
            "errors.family_delete_blocked",
            "Family could not be deleted or was not found"
          )
        );
      }
    },

    onSuccess: () => {
      refreshFamilyQueries();

      toast({
        title: label("toasts.family_deleted", "Family deleted"),
      });

      setFamilyPendingDelete(null);
      setDetailFamily(null);
    },

    onError: (err: any) =>
      toast({
        title: label("toasts.error_title", "Error"),
        description: err.message,
        variant: "destructive",
      }),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">
            {label("title", "Families")}
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            {label(
              "description",
              "Manage church families and their members"
            )}
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {label("actions.add_family", "Add Family")}
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">
                {label("dialogs.new_family", "New Family")}
              </DialogTitle>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>
                  {label(
                    "fields.family_name_required",
                    "Family Name *"
                  )}
                </Label>

                <Input
                  placeholder={label(
                    "placeholders.family_name",
                    "e.g. The Shumbusho Family"
                  )}
                  aria-label={label(
                    "fields.family_name",
                    "Family Name"
                  )}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDialogOpen(false)}
                >
                  {label("actions.cancel", "Cancel")}
                </Button>

                <Button
                  type="submit"
                  disabled={
                    create.isPending ||
                    !name.trim() ||
                    !churchId
                  }
                >
                  {create.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}

                  {label("actions.create", "Create")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">
          {label("loading", "Loading families...")}
        </p>
      ) : families.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />

            <p>
              {label(
                "empty.no_families",
                "No families registered yet."
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {families.map((family: any) => {
            const members = getFamilyMembersList(family.id);
            const total = getFamilyTotal(family.id);

            return (
              <Card
                key={family.id}
                className="glass-card hover:gold-glow transition-shadow cursor-pointer"
                onClick={() => setDetailFamily(family)}
              >
                <CardHeader className="pb-2 flex-row items-start justify-between gap-3 space-y-0">
                  <CardTitle className="text-base font-sans pr-2">
                    {family.name}
                  </CardTitle>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive"
                    disabled={
                      members.length > 0 ||
                      deleteFamily.isPending
                    }
                    aria-label={label(
                      "accessibility.delete_family_for",
                      "Delete family {{name}}",
                      { name: family.name }
                    )}
                    title={
                      members.length > 0
                        ? label(
                            "actions.delete_family_disabled",
                            "Remove all members before deleting this family"
                          )
                        : label("actions.delete_family", "Delete Family")
                    }
                    onClick={(event) => {
                      event.stopPropagation();

                      if (members.length > 0) {
                        toast({
                          title: label("toasts.error_title", "Error"),
                          description: label(
                            "errors.delete_nonempty_family",
                            "Remove all members before deleting this family"
                          ),
                          variant: "destructive",
                        });

                        return;
                      }

                      setFamilyPendingDelete(family);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>

                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />

                    {label(
                      "cards.members_count",
                      "{{count}} members",
                      { count: members.length }
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <HandCoins className="h-3 w-3" />
                    {formatTZS(total)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Family details */}
      <Dialog
        open={!!detailFamily}
        onOpenChange={(open) => {
          if (!open) setDetailFamily(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {detailFamily?.name}
            </DialogTitle>
          </DialogHeader>

          {detailFamily && (
            <div className="space-y-4">
              <p className="text-sm font-medium">
                {label(
                  "details.total_contributions",
                  "Total Contributions"
                )}
                :{" "}
                <span className="text-primary">
                  {formatTZS(
                    getFamilyTotal(detailFamily.id)
                  )}
                </span>
              </p>

              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {label(
                    "details.family_members",
                    "Family Members"
                  )}
                </h4>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddMemberOpen(true)}
                  disabled={addFamilyMember.isPending}
                >
                  <UserPlus className="mr-2 h-3 w-3" />
                  {label("actions.add", "Add")}
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {label("table.name", "Name")}
                    </TableHead>

                    <TableHead>
                      {label("table.role", "Role")}
                    </TableHead>

                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {getFamilyMembersList(
                    detailFamily.id
                  ).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-muted-foreground py-4"
                      >
                        {label(
                          "empty.no_assigned_members",
                          "No members assigned"
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    getFamilyMembersList(
                      detailFamily.id
                    ).map((member: any) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.full_name}
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline">
                            {displayFamilyRole(
                              member.family_role
                            )}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            aria-label={label(
                              "accessibility.remove_member_for",
                              "Remove {{name}} from family",
                              { name: member.full_name }
                            )}
                            disabled={removeFamilyMember.isPending}
                            onClick={() =>
                              setMemberPendingRemoval(member)
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Add member */}
              {addMemberOpen && (
                <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/30">
                  <div className="space-y-2">
                    <Label>
                      {label("fields.member", "Member")}
                    </Label>

                    <Select
                      value={selectedMemberId}
                      onValueChange={setSelectedMemberId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={label(
                            "placeholders.select_member",
                            "Select member"
                          )}
                        />
                      </SelectTrigger>

                      <SelectContent>
                        {availableMembers.map(
                          (member: any) => (
                            <SelectItem
                              key={member.id}
                              value={member.id}
                            >
                              {member.full_name}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {label("fields.role", "Role")}
                    </Label>

                    <Select
                      value={selectedRole}
                      onValueChange={setSelectedRole}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {FAMILY_ROLES.map((role) => (
                          <SelectItem
                            key={role}
                            value={role}
                          >
                            {displayFamilyRole(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        addFamilyMember.mutate()
                      }
                      disabled={
                        !selectedMemberId ||
                        addFamilyMember.isPending
                      }
                    >
                      {addFamilyMember.isPending && (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      )}

                      {label("actions.assign", "Assign")}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setAddMemberOpen(false)
                      }
                    >
                      {label("actions.cancel", "Cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!memberPendingRemoval}
        onOpenChange={(open) => {
          if (!open && !removeFamilyMember.isPending) {
            setMemberPendingRemoval(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {label(
                "dialogs.remove_member_title",
                "Remove member from family?"
              )}
            </AlertDialogTitle>

            <AlertDialogDescription>
              {label(
                "dialogs.remove_member_description",
                "{{name}} will be removed from this family. Their member record and contributions will remain intact.",
                { name: memberPendingRemoval?.full_name ?? "" }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={removeFamilyMember.isPending}
            >
              {label("actions.cancel", "Cancel")}
            </AlertDialogCancel>

            <Button
              type="button"
              variant="destructive"
              disabled={
                !memberPendingRemoval ||
                removeFamilyMember.isPending
              }
              onClick={() => {
                if (memberPendingRemoval) {
                  removeFamilyMember.mutate(
                    memberPendingRemoval.id
                  );
                }
              }}
            >
              {removeFamilyMember.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {label("actions.confirm_remove", "Remove member")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!familyPendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleteFamily.isPending) {
            setFamilyPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {label("dialogs.delete_family_title", "Delete family?")}
            </AlertDialogTitle>

            <AlertDialogDescription>
              {label(
                "dialogs.delete_family_description",
                "Delete {{name}}? This is only allowed when the family has no members.",
                { name: familyPendingDelete?.name ?? "" }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFamily.isPending}>
              {label("actions.cancel", "Cancel")}
            </AlertDialogCancel>

            <Button
              type="button"
              variant="destructive"
              disabled={
                !familyPendingDelete ||
                deleteFamily.isPending
              }
              onClick={() => {
                if (familyPendingDelete) {
                  deleteFamily.mutate(familyPendingDelete);
                }
              }}
            >
              {deleteFamily.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {label("actions.confirm_delete_family", "Delete family")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
