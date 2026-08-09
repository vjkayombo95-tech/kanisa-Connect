import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle2, Download, FileDown, Loader2, Search, Users, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useChurchPermission } from "@/hooks/use-church-permission";
import { formatTZS } from "@/lib/currency";
import {
  buildEventRosterCsv,
  type EventRegistrationRosterRow,
  rosterValueMatchesSearch,
  summarizeEventRoster,
} from "@/lib/events/registration-roster";

const ALL = "all";

function displayDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("en-TZ") : "Not set";
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function statusLabel(status?: string | null) {
  return status ? status.replace(/_/g, " ") : "not set";
}

export default function EventRegistrationsPage() {
  const { eventId } = useParams();
  const { t } = useTranslation();
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const exportPermission = useChurchPermission("events", "manage");
  const [search, setSearch] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState(ALL);
  const [paymentFilter, setPaymentFilter] = useState(ALL);
  const [attendanceFilter, setAttendanceFilter] = useState(ALL);
  const [communityFilter, setCommunityFilter] = useState(ALL);
  const [ministryFilter, setMinistryFilter] = useState(ALL);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: roster = [], isLoading, error } = useQuery({
    queryKey: ["event-registration-roster", eventId],
    queryFn: async () => {
      if (!eventId) return [] as EventRegistrationRosterRow[];
      const { data, error: rosterError } = await supabase.rpc("get_event_registration_roster" as never, {
        p_event_id: eventId,
      } as never);
      if (rosterError) throw rosterError;
      return (data ?? []) as unknown as EventRegistrationRosterRow[];
    },
    enabled: !!eventId,
  });

  const { data: church } = useQuery({
    queryKey: ["event-roster-church", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data, error: churchError } = await supabase
        .from("churches")
        .select("name")
        .eq("id", churchId)
        .maybeSingle();
      if (churchError) throw churchError;
      return data as { name: string | null } | null;
    },
    enabled: !!churchId,
  });

  const eventInfo = roster[0];
  const isPaidEvent = eventInfo?.registration_type === "paid";
  const summary = useMemo(() => summarizeEventRoster(roster), [roster]);

  const uniqueCommunities = useMemo(
    () => Array.from(new Set(roster.map((row) => row.community_names).filter(Boolean) as string[])).sort(),
    [roster],
  );
  const uniqueMinistries = useMemo(
    () => Array.from(new Set(roster.map((row) => row.ministry_names).filter(Boolean) as string[])).sort(),
    [roster],
  );

  const filteredRows = useMemo(() => {
    return roster.filter((row) => {
      if (!rosterValueMatchesSearch(row, search)) return false;
      if (registrationFilter !== ALL && row.registration_status !== registrationFilter) return false;
      if (paymentFilter !== ALL && row.payment_status !== paymentFilter) return false;
      if (attendanceFilter !== ALL && row.attendance_status !== attendanceFilter) return false;
      if (communityFilter !== ALL && row.community_names !== communityFilter) return false;
      if (ministryFilter !== ALL && row.ministry_names !== ministryFilter) return false;
      return true;
    });
  }, [attendanceFilter, communityFilter, ministryFilter, paymentFilter, registrationFilter, roster, search]);

  const selectedVisibleIds = filteredRows.map((row) => row.attendance_id).filter((id) => selectedIds.includes(id));
  const allVisibleSelected = filteredRows.length > 0 && selectedVisibleIds.length === filteredRows.length;

  const markAttendance = useMutation({
    mutationFn: async (attendanceStatus: "attended" | "absent") => {
      if (!eventId || selectedIds.length === 0) return;
      const { data, error: markError } = await supabase.rpc("mark_event_registration_attendance" as never, {
        p_event_id: eventId,
        p_attendance_ids: selectedIds,
        p_attendance_status: attendanceStatus,
      } as never);
      if (markError) throw markError;
      const result = data as { success?: boolean; error?: string; updated_count?: number } | null;
      if (!result?.success) throw new Error(result?.error || t("church_admin.events.roster.mark_failed"));
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["event-registration-roster", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-attendance-summary"] });
      setSelectedIds([]);
      toast({ title: t("church_admin.events.roster.mark_saved", { count: result?.updated_count ?? 0 }) });
    },
    onError: (markError: Error) => toast({ title: t("church_admin.events.roster.mark_failed"), description: markError.message, variant: "destructive" }),
  });

  const exportCsv = () => {
    if (!exportPermission.allowed) return;
    const csv = buildEventRosterCsv(filteredRows);
    downloadBlob(`${eventInfo?.event_title || "event"}-registrations.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
  };

  const downloadPdf = async () => {
    if (!exportPermission.allowed) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const left = 40;
    let y = 42;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("KANISA CONNECT", left, y);
    y += 20;
    doc.setFontSize(11);
    doc.text(String(church?.name || t("church_admin.events.roster.parish")), left, y);
    y += 24;
    doc.setFontSize(13);
    doc.text(t("church_admin.events.roster.pdf_title").toUpperCase(), left, y);
    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${t("church_admin.events.roster.event")}: ${eventInfo?.event_title || ""}`, left, y);
    y += 14;
    doc.text(`${t("church_admin.events.roster.date_time")}: ${displayDate(eventInfo?.event_start_date)}`, left, y);
    y += 14;
    doc.text(`${t("church_admin.events.roster.location")}: ${eventInfo?.event_location || "-"}`, left, y);
    y += 14;
    doc.text(`${t("church_admin.events.roster.generated")}: ${new Date().toLocaleString("en-TZ")}`, left, y);
    y += 22;
    doc.text(
      `${t("church_admin.events.roster.total_registered")}: ${summary.totalRegistered}   ${t("church_admin.events.roster.confirmed")}: ${summary.confirmed}   ${t("church_admin.events.roster.payment_pending")}: ${summary.paymentPending}   ${t("church_admin.events.roster.attended")}: ${summary.attended}`,
      left,
      y,
    );
    y += 24;

    const headers = ["No.", t("church_admin.events.roster.full_name"), t("church_admin.events.roster.phone"), t("church_admin.events.roster.community"), t("church_admin.events.roster.ministry"), t("church_admin.events.roster.registration_status"), t("church_admin.events.roster.payment_status"), t("church_admin.events.roster.attendance_status")];
    const widths = [28, 145, 80, 110, 110, 95, 85, 90];
    doc.setFont("helvetica", "bold");
    headers.forEach((header, index) => doc.text(header, left + widths.slice(0, index).reduce((sum, width) => sum + width, 0), y));
    y += 14;
    doc.setFont("helvetica", "normal");
    filteredRows.forEach((row, index) => {
      if (y > 550) {
        doc.addPage();
        y = 42;
      }
      const values = [
        String(index + 1),
        row.full_name || "-",
        row.phone || "-",
        row.community_names || "-",
        row.ministry_names || "-",
        statusLabel(row.registration_status),
        isPaidEvent ? statusLabel(row.payment_status) : "-",
        statusLabel(row.attendance_status),
      ];
      values.forEach((value, cellIndex) => {
        const x = left + widths.slice(0, cellIndex).reduce((sum, width) => sum + width, 0);
        doc.text(doc.splitTextToSize(value, widths[cellIndex] - 6).slice(0, 2), x, y);
      });
      y += 24;
    });
    doc.save(`${eventInfo?.event_title || "event"}-registration-roster.pdf`);
  };

  const toggleVisibleSelection = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !filteredRows.some((row) => row.attendance_id === id)));
    } else {
      setSelectedIds((current) => Array.from(new Set([...current, ...filteredRows.map((row) => row.attendance_id)])));
    }
  };

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (error) {
    return <div className="space-y-4"><Button asChild variant="outline"><Link to="/church-admin/events"><ArrowLeft className="mr-2 h-4 w-4" />{t("church_admin.events.roster.back")}</Link></Button><p className="text-sm text-destructive">{(error as Error).message}</p></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/church-admin/events"><ArrowLeft className="mr-2 h-4 w-4" />{t("church_admin.events.roster.back")}</Link>
          </Button>
          <h1 className="text-2xl font-bold font-serif">{t("church_admin.events.roster.title")}</h1>
          <p className="text-sm text-muted-foreground">{eventInfo?.event_title || t("church_admin.events.roster.no_registrations")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={exportPermission.isLoading || !exportPermission.allowed || filteredRows.length === 0}><FileDown className="mr-2 h-4 w-4" />{t("church_admin.events.roster.export_csv")}</Button>
          <Button onClick={downloadPdf} disabled={exportPermission.isLoading || !exportPermission.allowed || filteredRows.length === 0}><Download className="mr-2 h-4 w-4" />{t("church_admin.events.roster.download_pdf")}</Button>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          [t("church_admin.events.roster.event"), eventInfo?.event_title || "-"],
          [t("church_admin.events.roster.date_time"), displayDate(eventInfo?.event_start_date)],
          [t("church_admin.events.roster.location"), eventInfo?.event_location || "-"],
          [t("church_admin.events.roster.registration_type"), isPaidEvent ? t("church_admin.events.registration.paid") : t("church_admin.events.registration.free")],
          [t("church_admin.events.roster.fee"), isPaidEvent ? formatTZS(Number(eventInfo?.registration_fee ?? 0)) : "-"],
          [t("church_admin.events.roster.capacity"), eventInfo?.registration_capacity ?? t("church_admin.events.registration.unlimited")],
          [t("church_admin.events.roster.audience"), eventInfo?.audience_mode || "-"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border/70 bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-medium">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          [t("church_admin.events.roster.total_registered"), summary.totalRegistered],
          [t("church_admin.events.roster.confirmed"), summary.confirmed],
          [t("church_admin.events.roster.payment_pending"), isPaidEvent ? summary.paymentPending : "-"],
          [t("church_admin.events.roster.paid"), isPaidEvent ? summary.paid : "-"],
          [t("church_admin.events.roster.cancelled"), summary.cancelled],
          [t("church_admin.events.roster.attended"), summary.attended],
          [t("church_admin.events.roster.absent"), summary.absent],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {isPaidEvent ? (
        <section className="grid gap-3 md:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("church_admin.events.roster.expected_revenue")}</p><p className="mt-1 text-lg font-semibold">{formatTZS(summary.expectedRevenue)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("church_admin.events.roster.verified_revenue")}</p><p className="mt-1 text-lg font-semibold">{formatTZS(summary.verifiedRevenue)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("church_admin.events.roster.pending_verification")}</p><p className="mt-1 text-lg font-semibold">{formatTZS(summary.pendingVerification)}</p></CardContent></Card>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-sans">{t("church_admin.events.roster.attendee_roster")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2 xl:col-span-2">
              <Label>{t("church_admin.events.roster.search")}</Label>
              <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder={t("church_admin.events.roster.search_placeholder")} /></div>
            </div>
            <Filter label={t("church_admin.events.roster.registration_status")} value={registrationFilter} onChange={setRegistrationFilter} options={["registered", "payment_pending", "payment_submitted", "confirmed", "cancelled", "refunded"]} />
            {isPaidEvent ? <Filter label={t("church_admin.events.roster.payment_status")} value={paymentFilter} onChange={setPaymentFilter} options={["pending", "submitted", "paid", "failed", "refunded"]} /> : null}
            <Filter label={t("church_admin.events.roster.attendance_status")} value={attendanceFilter} onChange={setAttendanceFilter} options={["unmarked", "attended", "absent"]} />
            <Filter label={t("church_admin.events.roster.community")} value={communityFilter} onChange={setCommunityFilter} options={uniqueCommunities} />
            <Filter label={t("church_admin.events.roster.ministry")} value={ministryFilter} onChange={setMinistryFilter} options={uniqueMinistries} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">{selectedIds.length} {t("church_admin.events.roster.selected")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => markAttendance.mutate("attended")} disabled={selectedIds.length === 0 || markAttendance.isPending}><CheckCircle2 className="mr-2 h-4 w-4" />{t("church_admin.events.roster.mark_attended")}</Button>
              <Button variant="outline" size="sm" onClick={() => markAttendance.mutate("absent")} disabled={selectedIds.length === 0 || markAttendance.isPending}><XCircle className="mr-2 h-4 w-4" />{t("church_admin.events.roster.mark_absent")}</Button>
            </div>
          </div>

          <ResponsiveTable label={t("church_admin.events.roster.attendee_roster")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"><Checkbox checked={allVisibleSelected} onCheckedChange={toggleVisibleSelection} aria-label={t("church_admin.events.roster.select_visible")} /></TableHead>
                  <TableHead>{t("church_admin.events.roster.full_name")}</TableHead>
                  <TableHead>{t("church_admin.events.roster.phone")}</TableHead>
                  <TableHead>{t("church_admin.events.roster.email")}</TableHead>
                  <TableHead>{t("church_admin.events.roster.community")}</TableHead>
                  <TableHead>{t("church_admin.events.roster.ministry")}</TableHead>
                  <TableHead>{t("church_admin.events.roster.registration_status")}</TableHead>
                  {isPaidEvent ? <TableHead>{t("church_admin.events.roster.payment_status")}</TableHead> : null}
                  <TableHead>{t("church_admin.events.roster.registered_at")}</TableHead>
                  <TableHead>{t("church_admin.events.roster.attendance_status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow><TableCell colSpan={isPaidEvent ? 10 : 9} className="py-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8 opacity-40" />{t("church_admin.events.roster.no_registrations")}</TableCell></TableRow>
                ) : filteredRows.map((row) => (
                  <TableRow key={row.attendance_id}>
                    <TableCell><Checkbox checked={selectedIds.includes(row.attendance_id)} onCheckedChange={(checked) => setSelectedIds((current) => checked ? [...current, row.attendance_id] : current.filter((id) => id !== row.attendance_id))} aria-label={row.full_name || row.attendance_id} /></TableCell>
                    <TableCell className="font-medium">{row.full_name || "-"}</TableCell>
                    <TableCell>{row.phone || "-"}</TableCell>
                    <TableCell>{row.email || "-"}</TableCell>
                    <TableCell>{row.community_names || "-"}</TableCell>
                    <TableCell>{row.ministry_names || "-"}</TableCell>
                    <TableCell><Badge variant="outline">{statusLabel(row.registration_status)}</Badge></TableCell>
                    {isPaidEvent ? <TableCell><Badge variant="outline">{statusLabel(row.payment_status)}</Badge></TableCell> : null}
                    <TableCell>{displayDate(row.registered_at)}</TableCell>
                    <TableCell><Badge variant={row.attendance_status === "attended" ? "default" : "outline"}>{statusLabel(row.attendance_status)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((option) => <SelectItem key={option} value={option}>{statusLabel(option)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
