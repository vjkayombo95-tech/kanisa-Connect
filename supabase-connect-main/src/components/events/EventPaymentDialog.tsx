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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTitle: string;
  amount: number;
  onSubmit: (paymentMethod: string, transactionReference: string, proofUrl: string) => Promise<void> | void;
  isSubmitting?: boolean;
};

const PAYMENT_METHODS = ["mobile_money", "bank_transfer", "cash", "card", "other"];

export function EventPaymentDialog({ open, onOpenChange, eventTitle, amount, onSubmit, isSubmitting }: Props) {
  const { t, i18n } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  const [paymentMethod, setPaymentMethod] = useState("mobile_money");
  const [transactionReference, setTransactionReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPaymentMethod("mobile_money");
      setTransactionReference("");
      setProofUrl("");
    }
    onOpenChange(nextOpen);
  };

  const missingEvidence = !transactionReference.trim() && !proofUrl.trim();

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("member_portal.parish_life.event_payment_title")}</DialogTitle>
          <DialogDescription>
            {t("member_portal.parish_life.event_payment_description", {
              event: eventTitle,
              amount: formatTZSForLanguage(amount, language),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("member_portal.parish_life.event_fee")}</span>
              <span className="font-medium text-primary">{formatTZSForLanguage(amount, language)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("member_portal.giving_account.payment_method")}</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {t(`member_portal.giving_account.payment_methods.${method}`, method)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("member_portal.parish_life.transaction_reference")}</Label>
            <Input value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t("member_portal.parish_life.payment_proof_path")}</Label>
            <Input value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} />
            <p className="text-xs text-muted-foreground">{t("member_portal.parish_life.event_payment_review_note")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={!!isSubmitting}>
            {t("member_portal.common.cancel")}
          </Button>
          <Button
            disabled={!!isSubmitting || missingEvidence}
            onClick={async () => {
              await onSubmit(paymentMethod, transactionReference.trim(), proofUrl.trim());
              close(false);
            }}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("member_portal.parish_life.submit_payment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
