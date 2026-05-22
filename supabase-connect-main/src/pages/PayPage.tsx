import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, HandCoins, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getChurchPaymentProfile, mockChurchPayment } from "@/lib/qr-payments";

const QUICK_AMOUNTS = [5000, 10000, 20000];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function isValidPhoneNumber(value: string) {
  return /^(?:\+?\d{10,15})$/.test(value.replace(/\s+/g, ""));
}

export default function PayPage() {
  const [searchParams] = useSearchParams();
  const churchId = searchParams.get("churchId")?.trim() ?? "";

  const church = useMemo(
    () => (churchId ? getChurchPaymentProfile(churchId) : null),
    [churchId],
  );

  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; phoneNumber?: string; churchId?: string }>({});
  const [isPaying, setIsPaying] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    const nextErrors: typeof errors = {};
    const numericAmount = Number(amount);

    if (!churchId) {
      nextErrors.churchId = "Missing church ID. Scan a valid church QR code first.";
    }

    if (!amount.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) {
      nextErrors.amount = "Enter a valid amount before continuing.";
    }

    if (!phoneNumber.trim() || !isValidPhoneNumber(phoneNumber)) {
      nextErrors.phoneNumber = "Enter a valid phone number in international or local numeric format.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePayNow = async () => {
    if (!validate()) return;

    setIsPaying(true);
    setIsSuccess(false);
    setPaymentReference("");

    try {
      const result = await mockChurchPayment({
        churchId,
        amount: Number(amount),
        phoneNumber,
      });

      setPaymentReference(result.reference);
      setIsSuccess(true);
      setErrors({});
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="relative overflow-hidden rounded-[32px] border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,rgba(11,15,22,0.98),rgba(14,20,30,0.94))] p-6 shadow-[0_35px_90px_-48px_rgba(0,0,0,0.92)] sm:p-8"
          >
            <div className="pointer-events-none absolute inset-x-10 top-0 h-28 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/75">Secure Giving</p>
              <h1 className="mt-3 text-3xl font-semibold text-foreground">
                {church?.name ?? "Church payment"}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                {church?.tagline ?? "Use the payment form to complete your contribution securely."}
              </p>

              <div className="mt-8 space-y-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Protected checkout</p>
                      <p className="text-sm text-muted-foreground">Your details are processed in a mock secure flow for this demo.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <HandCoins className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Fast contribution flow</p>
                      <p className="text-sm text-muted-foreground">Scan, choose an amount, enter a phone number, and complete payment.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
          >
            <Card className="overflow-hidden rounded-[32px] border-white/8 bg-card/90 shadow-[0_28px_70px_-42px_rgba(0,0,0,0.8)]">
              <CardContent className="space-y-6 p-6 sm:p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">Payment Form</p>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">Complete your giving</h2>
                  <p className="mt-2 text-sm text-muted-foreground">A small service fee may apply</p>
                  {errors.churchId ? (
                    <p className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {errors.churchId}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <label htmlFor="amount" className="text-sm font-medium text-foreground">Amount</label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setErrors((current) => ({ ...current, amount: undefined }));
                    }}
                    className="h-12 rounded-2xl border-white/10 bg-background/80 px-4"
                  />
                  {errors.amount ? <p className="text-sm text-destructive">{errors.amount}</p> : null}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {QUICK_AMOUNTS.map((quickAmount) => (
                    <motion.div key={quickAmount} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full rounded-2xl border-white/10 bg-background/60 text-foreground hover:border-primary/40 hover:bg-primary/10"
                        onClick={() => {
                          setAmount(String(quickAmount));
                          setErrors((current) => ({ ...current, amount: undefined }));
                        }}
                      >
                        {quickAmount.toLocaleString()}
                      </Button>
                    </motion.div>
                  ))}
                </div>

                <div className="space-y-3">
                  <label htmlFor="phoneNumber" className="text-sm font-medium text-foreground">Phone number</label>
                  <div className="relative">
                    <Smartphone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phoneNumber"
                      type="tel"
                      inputMode="tel"
                      placeholder="e.g. 0712345678 or +255712345678"
                      value={phoneNumber}
                      onChange={(event) => {
                        setPhoneNumber(event.target.value);
                        setErrors((current) => ({ ...current, phoneNumber: undefined }));
                      }}
                      className="h-12 rounded-2xl border-white/10 bg-background/80 pl-11"
                    />
                  </div>
                  {errors.phoneNumber ? <p className="text-sm text-destructive">{errors.phoneNumber}</p> : null}
                </div>

                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Button
                    className="h-12 w-full rounded-2xl text-base shadow-[0_18px_40px_-24px_rgba(245,158,11,0.7)]"
                    onClick={handlePayNow}
                    disabled={isPaying || !churchId}
                  >
                    {isPaying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Pay Now
                  </Button>
                </motion.div>

                <AnimatePresence mode="wait">
                  {isSuccess ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-2xl border border-primary/25 bg-primary/10 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <div>
                          <p className="text-base font-medium text-foreground">Thank you for your contribution 🙏</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatCurrency(Number(amount))} is being processed for {church?.name ?? "this church"}.
                          </p>
                          {paymentReference ? (
                            <p className="mt-2 text-xs font-medium uppercase tracking-[0.22em] text-primary/80">
                              Ref: {paymentReference}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
