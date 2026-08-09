export type EventRosterAttendanceStatus = "unmarked" | "attended" | "absent";

export type EventRegistrationRosterRow = {
  attendance_id: string;
  event_id: string;
  church_id: string;
  event_title: string;
  event_start_date: string | null;
  event_end_date: string | null;
  event_location: string | null;
  audience_mode: string | null;
  registration_type: "free" | "paid" | string | null;
  registration_fee: number | string | null;
  registration_currency: string | null;
  registration_capacity: number | string | null;
  member_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  community_names: string | null;
  ministry_names: string | null;
  registration_status: string | null;
  payment_status: string | null;
  registered_at: string | null;
  attendance_status: EventRosterAttendanceStatus | string | null;
  amount_due: number | string | null;
  payment_reference: string | null;
  latest_payment_status: string | null;
  expected_revenue: number | string | null;
  verified_revenue: number | string | null;
  pending_verification: number | string | null;
};

export type EventRosterSummary = {
  totalRegistered: number;
  confirmed: number;
  paymentPending: number;
  paid: number;
  cancelled: number;
  attended: number;
  absent: number;
  expectedRevenue: number;
  verifiedRevenue: number;
  pendingVerification: number;
};

export function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeEventRoster(rows: EventRegistrationRosterRow[]): EventRosterSummary {
  const first = rows[0];

  return {
    totalRegistered: rows.length,
    confirmed: rows.filter((row) => row.registration_status === "confirmed").length,
    paymentPending: rows.filter((row) => row.payment_status === "pending" || row.payment_status === "submitted").length,
    paid: rows.filter((row) => row.payment_status === "paid").length,
    cancelled: rows.filter((row) => row.registration_status === "cancelled").length,
    attended: rows.filter((row) => row.attendance_status === "attended").length,
    absent: rows.filter((row) => row.attendance_status === "absent").length,
    expectedRevenue: numberValue(first?.expected_revenue),
    verifiedRevenue: numberValue(first?.verified_revenue),
    pendingVerification: numberValue(first?.pending_verification),
  };
}

export function rosterValueMatchesSearch(row: EventRegistrationRosterRow, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;

  return [row.full_name, row.phone, row.email]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

export function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildEventRosterCsv(rows: EventRegistrationRosterRow[]) {
  const headers = [
    "Event",
    "Full Name",
    "Phone",
    "Email",
    "Jumuiya",
    "Ministry",
    "Registration Status",
    "Payment Status",
    "Registration Date",
    "Attendance Status",
  ];
  const lines = rows.map((row) => [
    row.event_title,
    row.full_name,
    row.phone,
    row.email,
    row.community_names,
    row.ministry_names,
    row.registration_status,
    row.payment_status,
    row.registered_at,
    row.attendance_status,
  ].map(csvEscape).join(","));

  return [headers.map(csvEscape).join(","), ...lines].join("\n");
}
