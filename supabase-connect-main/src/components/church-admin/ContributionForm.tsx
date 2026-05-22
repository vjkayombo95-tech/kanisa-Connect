import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ContributionCategorySelector } from "@/components/ui/ContributionCategorySelector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HandCoins, Loader2 } from "lucide-react";
import { readOfflineDraft, writeOfflineDraft } from "@/lib/offline-drafts";
import { useTranslation } from "react-i18next";

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
  members,
  categories,
  initialValues,
  draftStorageKey,
  isSubmitting,
  onCancel,
  onSubmit,
}: ContributionFormProps) {
  const [values, setValues] = useState<ContributionFormValues>(EMPTY_VALUES);
  const { t } = useTranslation();

  useEffect(() => {
    if (!isEdit && draftStorageKey) {
      setValues(readOfflineDraft(draftStorageKey, { ...EMPTY_VALUES, ...initialValues }));
      return;
    }

    setValues({ ...EMPTY_VALUES, ...initialValues });
  }, [draftStorageKey, initialValues, isEdit]);

  useEffect(() => {
    if (!draftStorageKey || isEdit) return;
    writeOfflineDraft(draftStorageKey, values);
  }, [draftStorageKey, isEdit, values]);

  const memberItems = useMemo(
    () => members.map((member) => <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>),
    [members],
  );

  const handleMemberChange = (selectedMemberId: string) => {
    const selectedMember = members.find((member) => member.id === selectedMemberId);

    setValues((prev) => ({
      ...prev,
      member_id: selectedMemberId,
      donor_name: selectedMember?.full_name ?? prev.donor_name,
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
          <Select value={values.member_id} onValueChange={handleMemberChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select member" />
            </SelectTrigger>
            <SelectContent>{memberItems}</SelectContent>
          </Select>
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
