import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
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
import { formatTZSForLanguage } from "@/lib/currency";
import { normalizeAppLanguage } from "@/lib/localization";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  maxAmount: number;
  onSubmit: (amount: number, paymentMethod: string, transactionId: string, proofUrl: string) => Promise<void> | void;
  isSubmitting?: boolean;
  feePercentage?: number;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export function PledgePaymentDialog({
  open,
  onOpenChange,
  title,
  maxAmount,
  onSubmit,
  isSubmitting,
  feePercentage = 1,
}: Props) {
  const { t, i18n } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mobile_money");
  const [transactionId, setTransactionId] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setAmount("");
      setPaymentMethod("mobile_money");
      setTransactionId("");
      setProofUrl("");
    }
    onOpenChange(nextOpen);
  };

  const numericAmount = Number(amount || 0);
  const grossAmount = numericAmount > 0 ? Number((numericAmount / (1 - feePercentage / 100)).toFixed(2)) : 0;
  const feeAmount = grossAmount > 0 ? Number((grossAmount - numericAmount).toFixed(2)) : 0;
  const invalidAmount = !numericAmount || numericAmount <= 0 || numericAmount > maxAmount;
  const missingEvidence = !transactionId.trim() && !proofUrl.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t("member_portal.giving_account.pledge_payment_description", {
              balance: formatTZSForLanguage(maxAmount, language),
              fee: feePercentage,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("member_portal.giving_account.amount_for_church_tzs")}</Label>
            <Input
              type="number"
              min="1"
              max={Math.max(maxAmount, 0)}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={t("member_portal.giving_account.enter_amount_church_receives")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("member_portal.giving_account.transaction_id")}</Label>
            <Input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder={t("member_portal.giving_account.transaction_id_placeholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("member_portal.giving_account.proof_image_path")}</Label>
            <Input value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder={t("member_portal.giving_account.proof_image_placeholder")} />
            <p className="text-xs text-muted-foreground">{t("member_portal.giving_account.payment_approval_note")}</p>
          </div>

          <div className="space-y-2">
            <Label>{t("member_portal.giving_account.payment_method")}</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder={t("member_portal.giving_account.choose_payment_method")} />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {t(`member_portal.giving_account.payment_methods.${method.value}`, method.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {numericAmount > 0 ? (
            <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("member_portal.giving_account.church_receives")}</span>
                <span>{formatTZSForLanguage(numericAmount, language)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("member_portal.giving_account.platform_fee", { fee: feePercentage })}</span>
                <span>{formatTZSForLanguage(feeAmount, language)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 text-sm font-medium">
                <span>{t("member_portal.giving_account.you_pay")}</span>
                <span className="text-primary">{formatTZSForLanguage(grossAmount, language)}</span>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={!!isSubmitting}>
            {t("member_portal.common.cancel")}
          </Button>
          <Button
            disabled={!!isSubmitting || invalidAmount || missingEvidence}
            onClick={async () => {
              await onSubmit(grossAmount, paymentMethod, transactionId.trim(), proofUrl.trim());
              handleClose(false);
            }}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("member_portal.giving_account.submit_for_approval")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
