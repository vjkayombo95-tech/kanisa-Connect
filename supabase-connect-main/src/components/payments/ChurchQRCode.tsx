import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

import { buildChurchQRPayload } from "@/lib/qr-payments";

type ChurchQRCodeProps = {
  churchId: string;
  churchName?: string;
  className?: string;
};

export function ChurchQRCode({ churchId, churchName, className }: ChurchQRCodeProps) {
  const qrValue = buildChurchQRPayload(churchId);

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      <div className="relative overflow-hidden rounded-[28px] border border-primary/15 bg-[linear-gradient(180deg,rgba(12,16,24,0.96),rgba(18,24,36,0.92))] p-6 shadow-[0_28px_70px_-40px_rgba(0,0,0,0.92)] sm:p-8">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-28 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/75">
            Digital Giving
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-foreground">Scan to Give</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {churchName ? `Support ${churchName} instantly from your phone.` : "Support your church instantly from your phone."}
          </p>

          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.35 }}
            className="mt-8 rounded-[28px] border border-white/10 bg-white p-4 shadow-[0_18px_50px_-30px_rgba(245,158,11,0.7)]"
          >
            <QRCodeSVG
              value={qrValue}
              size={220}
              level="H"
              marginSize={4}
              bgColor="#FFFFFF"
              fgColor="#111827"
              title="Church giving QR code"
            />
          </motion.div>

          <p className="mt-6 text-sm text-muted-foreground">
            Scan with the in-app camera to open a secure payment screen for this church.
          </p>
        </div>
      </div>
    </motion.section>
  );
}
