import { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, MessageCircle, Printer } from "lucide-react";

import { buildChurchQRPayload } from "@/lib/qr-payments";
import { buildContributionShareMessage, openWhatsAppShare } from "@/lib/whatsapp-share";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ChurchQRCodeProps = {
  churchId: string;
  churchName?: string;
  churchSlug?: string | null;
  churchLogo?: string | null;
  className?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function ChurchQRCode({ churchId, churchName, churchSlug, churchLogo, className }: ChurchQRCodeProps) {
  const qrValue = useMemo(() => buildChurchQRPayload(churchId, churchSlug), [churchId, churchSlug]);
  const qrRef = useRef<SVGSVGElement | null>(null);
  const { toast } = useToast();

  const copyGivingLink = async () => {
    await navigator.clipboard.writeText(qrValue);
    toast({ title: "Giving link copied" });
  };

  const shareGivingLink = () => {
    openWhatsAppShare(buildContributionShareMessage({ churchName, givingLink: qrValue }));
  };

  const downloadQrCode = () => {
    const svg = qrRef.current;
    if (!svg) return;

    const serializedSvg = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serializedSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${churchSlug || churchId}-giving-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printPoster = () => {
    const svg = qrRef.current;
    if (!svg) return;

    const serializedSvg = new XMLSerializer().serializeToString(svg);
    const qrDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializedSvg)}`;
    const posterWindow = window.open("", "_blank", "width=900,height=1100");
    if (!posterWindow) return;
    const safeChurchName = escapeHtml(churchName || "Church");
    const safeChurchLogo = churchLogo ? escapeHtml(churchLogo) : "";
    const safeQrValue = escapeHtml(qrValue);

    posterWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${safeChurchName} Scan to Give</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              font-family: Arial, sans-serif;
              background: #f4f5f7;
              color: #101827;
            }
            .poster {
              width: min(92vw, 720px);
              min-height: 920px;
              padding: 56px;
              border-radius: 36px;
              background: #071426;
              color: white;
              text-align: center;
              box-shadow: 0 24px 80px rgba(0, 0, 0, 0.24);
            }
            .logo {
              width: 112px;
              height: 112px;
              object-fit: cover;
              border-radius: 24px;
              background: white;
              margin-bottom: 24px;
            }
            h1 { margin: 0; font-size: 44px; }
            h2 { margin: 24px 0 8px; color: #f4b321; letter-spacing: 0.18em; text-transform: uppercase; font-size: 16px; }
            .qr {
              margin: 44px auto 28px;
              width: 360px;
              height: 360px;
              padding: 24px;
              background: white;
              border-radius: 28px;
            }
            .qr img { width: 100%; height: 100%; }
            p { font-size: 22px; line-height: 1.45; color: #d9e2ef; }
            .link { margin-top: 28px; font-size: 15px; color: #f4b321; overflow-wrap: anywhere; }
            @media print {
              body { background: white; }
              .poster { width: 100%; min-height: 100vh; border-radius: 0; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <main class="poster">
            ${safeChurchLogo ? `<img class="logo" src="${safeChurchLogo}" alt="${safeChurchName} logo" />` : ""}
            <h2>Digital Giving</h2>
            <h1>${safeChurchName}</h1>
            <div class="qr"><img src="${qrDataUrl}" alt="Giving QR code" /></div>
            <h1>Scan to Give</h1>
            <p>Scan with your phone camera to send your contribution.</p>
            <p class="link">${safeQrValue}</p>
          </main>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    posterWindow.document.close();
  };

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
              ref={qrRef}
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
            Scan with any phone camera to open the public giving page for this church.
          </p>

          <div className="mt-5 w-full max-w-md rounded-2xl border border-white/8 bg-background/50 p-3 text-left">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Giving link</p>
            <p className="mt-2 break-all text-sm text-foreground">{qrValue}</p>
          </div>

          <div className="mt-5 grid w-full max-w-md gap-3">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => void copyGivingLink()}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Giving Link
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={shareGivingLink}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Share Giving Link to WhatsApp
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={downloadQrCode}>
              <Download className="mr-2 h-4 w-4" />
              Download QR Code
            </Button>
            <Button type="button" className="rounded-xl" onClick={printPoster}>
              <Printer className="mr-2 h-4 w-4" />
              Print QR Poster
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
