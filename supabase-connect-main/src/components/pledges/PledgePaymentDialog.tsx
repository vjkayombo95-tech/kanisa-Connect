import { useState } from "react";
import { Loader2 } from "lucide-react";

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
  onSubmit: (amount: number, paymentMethod: string) => Promise<void> | void;
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
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mobile_money");

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setAmount("");
      setPaymentMethod("mobile_money");
    }
    onOpenChange(nextOpen);
  };

  const numericAmount = Number(amount || 0);
  const grossAmount = numericAmount > 0 ? Number((numericAmount / (1 - feePercentage / 100)).toFixed(2)) : 0;
  const feeAmount = grossAmount > 0 ? Number((grossAmount - numericAmount).toFixed(2)) : 0;
  const invalidAmount = !numericAmount || numericAmount <= 0 || numericAmount > maxAmount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Remaining balance: {formatTZS(maxAmount)}. Enter the amount the church should receive and the {feePercentage}% platform fee will be added on top.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Amount For Church (TZS)</Label>
            <Input
              type="number"
              min="1"
              max={Math.max(maxAmount, 0)}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Enter amount church should receive"
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Choose payment method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {numericAmount > 0 ? (
            <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Church receives</span>
                <span>{formatTZS(numericAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Platform fee ({feePercentage}%)</span>
                <span>{formatTZS(feeAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 text-sm font-medium">
                <span>You pay</span>
                <span className="text-primary">{formatTZS(grossAmount)}</span>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={!!isSubmitting}>
            Cancel
          </Button>
          <Button
            disabled={!!isSubmitting || invalidAmount}
            onClick={async () => {
              await onSubmit(grossAmount, paymentMethod);
              handleClose(false);
            }}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Pay Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
