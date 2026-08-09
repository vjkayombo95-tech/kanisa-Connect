import type { ParishCalendarEvent, ParishCalendarEventType } from "@/components/calendar/types";

export type SacramentType =
  | "baptism"
  | "first_communion"
  | "confirmation"
  | "marriage"
  | "holy_orders"
  | "anointing"
  | "funeral"
  | "rcia";

export type SacramentStatus =
  | "planned"
  | "preparation"
  | "scheduled"
  | "completed"
  | "certificate_ready"
  | "certificate_issued"
  | "cancelled"
  | "archived";

export type SacramentalRecord = {
  id: string;
  church_id: string;
  member_id: string | null;
  member_name?: string | null;
  sacrament_type: SacramentType;
  status: SacramentStatus;
  sacrament_date: string | null;
  minister: string | null;
  location: string | null;
  certificate_number: string | null;
  register_page: string | null;
  sponsors: unknown[];
  witnesses: unknown[];
  parents: Record<string, unknown>;
  spouse: Record<string, unknown>;
  preparation: Record<string, unknown>;
  documents: Array<{ name: string; url?: string; path?: string; type?: string; uploadedAt?: string }>;
  notes: string | null;
  certificate_issued_at: string | null;
  certificate_ready_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export const sacramentOptions: Array<{ value: SacramentType; label: string; shortLabel: string }> = [
  { value: "baptism", label: "Baptism", shortLabel: "Baptism" },
  { value: "first_communion", label: "First Holy Communion", shortLabel: "Communion" },
  { value: "confirmation", label: "Confirmation", shortLabel: "Confirmation" },
  { value: "marriage", label: "Marriage", shortLabel: "Marriage" },
  { value: "holy_orders", label: "Holy Orders", shortLabel: "Holy Orders" },
  { value: "anointing", label: "Anointing of the Sick", shortLabel: "Anointing" },
  { value: "funeral", label: "Funeral", shortLabel: "Funeral" },
  { value: "rcia", label: "RCIA / Catechumenate", shortLabel: "RCIA" },
];

export const sacramentStatusOptions: Array<{ value: SacramentStatus; label: string }> = [
  { value: "planned", label: "Planned" },
  { value: "preparation", label: "Preparation" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "certificate_ready", label: "Certificate Ready" },
  { value: "certificate_issued", label: "Certificate Issued" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" },
];

export function sacramentLabel(type: string | null | undefined) {
  return sacramentOptions.find((option) => option.value === type)?.label ?? "Sacrament";
}

export function sacramentShortLabel(type: string | null | undefined) {
  return sacramentOptions.find((option) => option.value === type)?.shortLabel ?? "Sacrament";
}

export function sacramentStatusLabel(status: string | null | undefined) {
  return sacramentStatusOptions.find((option) => option.value === status)?.label ?? "Planned";
}

export function sacramentStatusClass(status: string | null | undefined) {
  if (status === "completed" || status === "certificate_issued") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  if (status === "certificate_ready") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "scheduled") return "border-blue-400/30 bg-blue-500/10 text-blue-300";
  if (status === "preparation") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  if (status === "cancelled" || status === "archived") return "border-border text-muted-foreground";
  return "border-muted-foreground/20 bg-muted/20 text-muted-foreground";
}

export function sacramentCalendarType(type: SacramentType): ParishCalendarEventType {
  if (type === "baptism") return "baptism";
  if (type === "marriage") return "wedding";
  if (type === "funeral") return "funeral";
  if (type === "confirmation") return "confirmation";
  if (type === "first_communion") return "first_communion";
  if (type === "anointing") return "anointing_of_sick";
  if (type === "rcia") return "catechism";
  return "training";
}

export function buildSacramentalTimeline(records: SacramentalRecord[]) {
  return [...records]
    .filter((record) => record.member_id && record.sacrament_date)
    .sort((a, b) => new Date(a.sacrament_date ?? 0).getTime() - new Date(b.sacrament_date ?? 0).getTime())
    .map((record) => ({
      id: record.id,
      year: record.sacrament_date ? new Date(record.sacrament_date).getFullYear() : null,
      title: sacramentLabel(record.sacrament_type),
      status: record.status,
      date: record.sacrament_date,
      certificateNumber: record.certificate_number,
    }));
}

export function summarizeSacraments(records: SacramentalRecord[]) {
  const now = new Date();
  const year = now.getFullYear();
  const upcoming = records.filter((record) => record.sacrament_date && new Date(record.sacrament_date) >= now);
  const thisYear = records.filter((record) => record.sacrament_date && new Date(record.sacrament_date).getFullYear() === year);
  const pendingCertificates = records.filter((record) => record.status === "completed" || record.status === "certificate_ready");

  return {
    total: records.length,
    upcoming: upcoming.length,
    thisYear: thisYear.length,
    pendingCertificates: pendingCertificates.length,
    byType: sacramentOptions.map((option) => ({
      type: option.value,
      label: option.shortLabel,
      count: records.filter((record) => record.sacrament_type === option.value).length,
      thisYear: thisYear.filter((record) => record.sacrament_type === option.value).length,
    })),
  };
}

export function mapSacramentToCalendarEvent(record: SacramentalRecord): ParishCalendarEvent | null {
  if (!record.sacrament_date || record.status === "cancelled" || record.status === "archived") return null;
  const type = sacramentCalendarType(record.sacrament_type);
  return {
    id: `sacrament-${record.id}`,
    title: `${sacramentShortLabel(record.sacrament_type)}${record.member_name ? `: ${record.member_name}` : ""}`,
    description: record.notes,
    type,
    category: type === "baptism" || type === "wedding" || type === "confirmation" || type === "first_communion" || type === "anointing_of_sick" || type === "funeral" ? "prayer" : "ministry",
    startsAt: record.sacrament_date,
    endsAt: null,
    location: record.location,
    ministry: "Sacramental Life",
    churchId: record.church_id,
    visibility: "pastoral",
    workspace: "pastoral",
    source: "workflow",
    href: `/pastoral/sacraments?record=${encodeURIComponent(record.id)}`,
    status: record.status,
    metadata: {
      sourceTable: "sacramental_records",
      sacramentType: record.sacrament_type,
      certificateNumber: record.certificate_number,
      registerPage: record.register_page,
    },
  };
}

export async function downloadSacramentCertificate(record: SacramentalRecord, churchName?: string | null) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const center = pageWidth / 2;
  const title = `${sacramentLabel(record.sacrament_type)} Certificate`;

  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(2);
  doc.rect(36, 36, pageWidth - 72, 770);
  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.text(churchName || "Parish", center, 92, { align: "center" });
  doc.setFontSize(20);
  doc.text(title, center, 132, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(13);
  doc.text("This certifies that", center, 188, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.text(record.member_name || "Parishioner", center, 230, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(13);
  doc.text(`received ${sacramentLabel(record.sacrament_type)}`, center, 270, { align: "center" });
  if (record.sacrament_date) {
    doc.text(`on ${new Date(record.sacrament_date).toLocaleDateString()}`, center, 302, { align: "center" });
  }
  if (record.location) doc.text(`at ${record.location}`, center, 334, { align: "center" });
  if (record.minister) doc.text(`Minister: ${record.minister}`, center, 366, { align: "center" });
  doc.text(`Certificate No: ${record.certificate_number || "Pending"}`, 72, 462);
  doc.text(`Register Page: ${record.register_page || "Pending"}`, 72, 492);
  doc.line(72, 610, 240, 610);
  doc.text("Priest Signature", 102, 632);
  doc.roundedRect(370, 570, 110, 80, 8, 8);
  doc.text("Parish Seal", 395, 618);
  doc.roundedRect(72, 690, 90, 90, 6, 6);
  doc.setFontSize(10);
  doc.text("QR verification", 82, 740);
  doc.text("Verification QR placeholder", 72, 794);
  doc.save(`${record.certificate_number || record.id}-${record.sacrament_type}-certificate.pdf`);
}
