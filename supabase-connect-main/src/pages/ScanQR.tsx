import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { QrReader } from "react-qr-reader";
import { Camera, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { parseChurchQRPayload } from "@/lib/qr-payments";

type ScannerStatus = "loading" | "ready" | "success";

export default function ScanQR() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ScannerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [hasScanned, setHasScanned] = useState(false);

  const helperText = useMemo(() => {
    if (status === "success") return "QR detected. Redirecting to payment...";
    if (errorMessage) return errorMessage;
    if (status === "loading") return "Requesting camera access...";
    return "Center the church QR code inside the frame.";
  }, [errorMessage, status]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="relative overflow-hidden rounded-[32px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.14),transparent_34%),linear-gradient(180deg,rgba(11,15,22,0.98),rgba(14,20,30,0.95))] p-5 shadow-[0_35px_90px_-48px_rgba(0,0,0,0.9)] sm:p-6"
          >
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/75">QR Scanner</p>
                <h1 className="mt-2 text-3xl font-semibold text-foreground">Scan church giving code</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Open your camera, scan the church QR code, and we&apos;ll take you straight to the payment screen.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-3">
              {status === "loading" ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/75 backdrop-blur-sm">
                  <div className="flex items-center gap-3 rounded-full border border-white/10 bg-card/90 px-4 py-3 text-sm text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Starting camera...
                  </div>
                </div>
              ) : null}

              {hasScanned ? (
                <div className="flex aspect-[4/5] items-center justify-center rounded-[22px] border border-primary/20 bg-primary/5">
                  <div className="text-center">
                    <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
                    <p className="mt-4 text-base font-medium text-foreground">Secure redirect in progress</p>
                    <p className="mt-2 text-sm text-muted-foreground">Preparing payment details...</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[22px]">
                  <QrReader
                    constraints={{ facingMode: { ideal: "environment" } }}
                    scanDelay={400}
                    containerStyle={{ width: "100%" }}
                    videoContainerStyle={{ width: "100%", paddingTop: 0 }}
                    videoStyle={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onResult={(result, error) => {
                      if (!hasScanned && status === "loading") {
                        setStatus("ready");
                      }

                      if (result && !hasScanned) {
                        try {
                          const payload = parseChurchQRPayload(result.getText());
                          setHasScanned(true);
                          setStatus("success");
                          setErrorMessage("");
                          navigate(`/pay?churchId=${encodeURIComponent(payload.churchId)}`);
                        } catch (parseError) {
                          setErrorMessage(
                            parseError instanceof Error ? parseError.message : "Invalid QR code. Please scan a church payment QR.",
                          );
                        }
                      }

                      if (error) {
                        const message = error.message.toLowerCase();

                        if (message.includes("permission") || message.includes("denied")) {
                          setErrorMessage("Camera access was blocked. Please allow access and try again.");
                          setStatus("ready");
                        }

                        if (message.includes("no device") || message.includes("not found")) {
                          setErrorMessage("No camera was found on this device.");
                          setStatus("ready");
                        }
                      }
                    }}
                  />
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-8 top-8 bottom-8 rounded-[26px] border border-primary/50 shadow-[0_0_0_1px_rgba(245,158,11,0.18),0_0_0_999px_rgba(0,0,0,0.1)_inset]" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="space-y-5"
          >
            <Card className="overflow-hidden rounded-[28px] border-white/8 bg-card/90 shadow-[0_28px_70px_-42px_rgba(0,0,0,0.8)]">
              <CardContent className="space-y-5 p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">Status</p>
                  <div className="mt-3 flex items-start gap-3">
                    {errorMessage ? (
                      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    ) : status === "success" ? (
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    ) : (
                      <Loader2 className={`mt-0.5 h-5 w-5 shrink-0 text-primary ${status === "loading" ? "animate-spin" : ""}`} />
                    )}
                    <div>
                      <p className="text-base font-medium text-foreground">
                        {errorMessage ? "Scan issue detected" : status === "success" ? "QR accepted" : "Scanner active"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{helperText}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-background/50 p-4">
                  <p className="text-sm font-medium text-foreground">Tips for a faster scan</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>Use the rear camera on mobile for sharper focus.</li>
                    <li>Hold the code steady and keep it inside the gold frame.</li>
                    <li>Make sure the QR image is bright and fully visible.</li>
                  </ul>
                </div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
                  <Button className="h-11 w-full rounded-xl" onClick={() => navigate("/")}>
                    Return Home
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
