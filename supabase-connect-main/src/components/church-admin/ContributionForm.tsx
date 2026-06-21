import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ContributionCategorySelector } from "@/components/ui/ContributionCategorySelector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HandCoins, Loader2 } from "lucide-react";
import { readOfflineDraft, writeOfflineDraft } from "@/lib/offline-drafts";
import { useTranslation } from "react-i18next";
import { RemoteMemberSelect, type RemoteMemberOption } from "@/components/members/RemoteMemberSelect";

interface MemberOption {
  id: string;
  full_name: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

export interface ContributionFormValues {
  member_id: string;
  donor_name: string;
  category_id: string;
  amount: string;
  phone: string;
  payment_reference: string;
  notes: string;
  reason: string;
}

interface ContributionFormProps {
  isEdit: boolean;
  churchId?: string | null;
  members: MemberOption[];
  categories: CategoryOption[];
  initialValues?: Partial<ContributionFormValues>;
  draftStorageKey?: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (values: ContributionFormValues) => void;
}

const EMPTY_VALUES: ContributionFormValues = {
  member_id: "",
  donor_name: "",
  category_id: "",
  amount: "",
  phone: "",
  payment_reference: "",
  notes: "",
  reason: "",
};

const sanitizeAmount = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole, ...decimals] = cleaned.split(".");
  if (decimals.length === 0) return whole;
  return `${whole}.${decimals.join("")}`;
};

export function ContributionForm({
  isEdit,
  churchId,
  members,
  categories,
  initialValues,
  draftStorageKey,
  isSubmitting,
  onCancel,
  onSubmit,
}: ContributionFormProps) {
  const [values, setValues] = useState<ContributionFormValues>(EMPTY_VALUES);
  const [selectedMember, setSelectedMember] = useState<RemoteMemberOption | null>(null);
  const initialValuesRef = useRef(initialValues);
  const membersRef = useRef(members);
  const { t } = useTranslation();

  // The page creates these props inline. Keep the latest values available, but only
  // reset this form when the record/draft content itself changes, not on every page render.
  initialValuesRef.current = initialValues;
  membersRef.current = members;
  const initialValuesKey = JSON.stringify(initialValues ?? {});
  const membersKey = members.map((member) => `${member.id}:${member.full_name}`).join("|");

  useEffect(() => {
    const nextInitialValues = initialValuesRef.current;
    const nextMembers = membersRef.current;

    if (!isEdit && draftStorageKey) {
      const nextValues = readOfflineDraft(draftStorageKey, { ...EMPTY_VALUES, ...nextInitialValues });
      setValues(nextValues);
      setSelectedMember(
        nextMembers.find((member) => member.id === nextValues.member_id) ??
          (nextValues.member_id && nextValues.donor_name
            ? { id: nextValues.member_id, full_name: nextValues.donor_name }
            : null),
      );
      return;
    }

    const nextValues = { ...EMPTY_VALUES, ...nextInitialValues };
    setValues(nextValues);
    setSelectedMember(
      nextMembers.find((member) => member.id === nextValues.member_id) ??
        (nextValues.member_id && nextValues.donor_name
          ? { id: nextValues.member_id, full_name: nextValues.donor_name }
          : null),
    );
  }, [draftStorageKey, initialValuesKey, isEdit, membersKey]);

  useEffect(() => {
    if (!draftStorageKey || isEdit) return;
    writeOfflineDraft(draftStorageKey, values);
  }, [draftStorageKey, isEdit, values]);

  const handleMemberChange = (member: RemoteMemberOption | null) => {
    setSelectedMember(member);
    setValues((prev) => ({
      ...prev,
      member_id: member?.id ?? "",
      donor_name: member?.full_name ?? "",
    }));
  };

  const canSubmit =
    !isSubmitting &&
    values.amount.trim().length > 0 &&
    values.category_id.trim().length > 0 &&
    (!isEdit || values.reason.trim().length > 0);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit(values);
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Member</Label>
          <RemoteMemberSelect
            churchId={churchId}
            value={values.member_id}
            selectedMember={selectedMember}
            onValueChange={handleMemberChange}
          />
        </div>

        <div className="space-y-2">
          <Label>Or Donor Name</Label>
          <Input
            placeholder="Non-member donor"
            value={values.donor_name}
            onChange={(event) => setValues((prev) => ({ ...prev, donor_name: event.target.value }))}
            disabled={!!values.member_id}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("contributions.category")} *</Label>
          <ContributionCategorySelector
            categories={categories}
            value={values.category_id}
            onValueChange={(categoryId) => setValues((prev) => ({ ...prev, category_id: categoryId }))}
          />
        </div>

        <div className="space-y-2">
          <Label>Amount (TZS) *</Label>
          <Input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={values.amount}
            onChange={(event) => setValues((prev) => ({ ...prev, amount: sanitizeAmount(event.target.value) }))}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            placeholder="+255..."
            value={values.phone}
            onChange={(event) => setValues((prev) => ({ ...prev, phone: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label>Payment Reference</Label>
          <Input
            placeholder="M-Pesa ref, receipt #"
            value={values.payment_reference}
            onChange={(event) => setValues((prev) => ({ ...prev, payment_reference: event.target.value }))}
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label>Notes</Label>
          <Input
            placeholder="Optional notes"
            value={values.notes}
            onChange={(event) => setValues((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </div>

        {isEdit && (
          <div className="space-y-2 col-span-2">
            <Label className="text-warning">Reason for Edit *</Label>
            <Textarea
              placeholder="Why is this contribution being edited?"
              value={values.reason}
              onChange={(event) => setValues((prev) => ({ ...prev, reason: event.target.value }))}
              required
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <HandCoins className="mr-2 h-4 w-4" />
          {isEdit ? "Save Changes" : "Record"}
        </Button>
      </div>
      {draftStorageKey && !isEdit ? (
        <p className="text-xs text-muted-foreground">This draft is saved on this device while you type.</p>
      ) : null}
    </form>
  );
}
