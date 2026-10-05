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
import { formatTZS } from "@/lib/currency";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  maxAmount: number;
  onSubmit: (amount: number, paymentMethod: string, transactionId: string, proofUrl: string) => Promise<void> | void;
  isSubmitting?: boolean;
  feePercentage?: number;
}

const PAYMENT_METHODS = ["cash", "mobile_money", "bank_transfer", "card", "other"] as const;

export function PledgePaymentDialog({
  open,
  onOpenChange,
  title,
  maxAmount,
  onSubmit,
  isSubmitting,
  feePercentage = 1,
}: Props) {
  const { t } = useTranslation();
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
            {t("pledge_payment_dialog.description", { balance: formatTZS(maxAmount), feePercentage })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("pledge_payment_dialog.amount_label")}</Label>
            <Input
              type="number"
              min="1"
              max={Math.max(maxAmount, 0)}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={t("pledge_payment_dialog.amount_placeholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("pledge_payment_dialog.transaction_id_label")}</Label>
            <Input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder={t("pledge_payment_dialog.transaction_id_placeholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("pledge_payment_dialog.proof_label")}</Label>
            <Input value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder={t("pledge_payment_dialog.proof_placeholder")} />
            <p className="text-xs text-muted-foreground">{t("pledge_payment_dialog.approval_helper")}</p>
          </div>

          <div className="space-y-2">
            <Label>{t("pledge_payment_dialog.payment_method_label")}</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder={t("pledge_payment_dialog.payment_method_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {t(`pledge_payment_dialog.payment_methods.${method}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {numericAmount > 0 ? (
            <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("pledge_payment_dialog.breakdown.church_receives")}</span>
                <span>{formatTZS(numericAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("pledge_payment_dialog.breakdown.platform_fee", { feePercentage })}</span>
                <span>{formatTZS(feeAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 text-sm font-medium">
                <span>{t("pledge_payment_dialog.breakdown.you_pay")}</span>
                <span className="text-primary">{formatTZS(grossAmount)}</span>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={!!isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!!isSubmitting || invalidAmount || missingEvidence}
            onClick={async () => {
              await onSubmit(grossAmount, paymentMethod, transactionId.trim(), proofUrl.trim());
              handleClose(false);
            }}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? t("pledge_payment_dialog.submitting") : t("pledge_payment_dialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
