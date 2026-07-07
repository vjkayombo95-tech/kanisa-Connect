import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ClipboardList,
  Download,
  Eye,
  FilePenLine,
  Flame,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PageToolbar, getWorkspacePageActions, useWorkspacePage } from "@/components/workspace";
import { useAuth } from "@/contexts/AuthContext";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { useToast } from "@/hooks/use-toast";
import { formatTZS } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { PaginationFooter } from "@/components/ui/pagination-footer";

type PaymentStatus = "pending" | "paid" | "unpaid" | "failed" | string;
type IntentionStatus = "pending" | "approved" | "rejected" | "scheduled" | "completed" | "archived" | string;

type MassIntentionRow = {
  id: string;
  church_id: string | null;
  member_id: string | null;
  requested_by_name: string | null;
  requested_by_phone: string | null;
  offered_for_name: string | null;
  intention_type: string | null;
  intention: string | null;
  message: string | null;
  mass_date: string | null;
  mass_time: string | null;
  mass_name: string | null;
  amount: number | null;
  offering_amount: number | null;
  payment_status: PaymentStatus | null;
  status: IntentionStatus | null;
  proof_image_url: string | null;
  created_at: string;
  updated_at: string | null;
  members?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

type ChurchInfo = {
  name: string | null;
  logo_url: string | null;
};

const EMPTY_INTENTIONS: MassIntentionRow[] = [];
const EMPTY_MASS_TIMES: string[] = [];

type MassIntentionsPageData = {
  rows: MassIntentionRow[];
  count: number;
  summary: {
    today: number;
    pendingPayment: number;
    approved: number;
    collected: number;
  };
  massTimeOptions: string[];
  church: ChurchInfo | null;
};

type FormState = {
  id?: string;
  requested_by_name: string;
  requested_by_phone: string;
  offered_for_name: string;
  intention_type: string;
  message: string;
  mass_date: string;
  mass_time: string;
  mass_name: string;
  amount: string;
  payment_status: PaymentStatus;
  status: IntentionStatus;
};

const emptyForm: FormState = {
  requested_by_name: "",
  requested_by_phone: "",
  offered_for_name: "",
  intention_type: "thanksgiving",
  message: "",
  mass_date: "",
  mass_time: "",
  mass_name: "",
  amount: "",
  payment_status: "pending",
  status: "approved",
};

const intentionTypes = [
  "thanksgiving",
  "healing",
  "remembrance",
  "special_intention",
  "for_the_departed",
  "for_peace",
];

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

function cleanLabel(value: string | null | undefined) {
  if (!value) return "-";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getRequestedBy(row: MassIntentionRow) {
  return row.requested_by_name || row.members?.full_name || "Office entry";
}

function getPhone(row: MassIntentionRow) {
  return row.requested_by_phone || row.members?.phone || "-";
}

function getOfferedFor(row: MassIntentionRow) {
  return row.offered_for_name || row.intention || getRequestedBy(row);
}

function getAmount(row: MassIntentionRow) {
  return Number(row.amount ?? row.offering_amount ?? 0);
}

function badgeClass(status: string | null | undefined, kind: "payment" | "approval") {
  const value = status?.toLowerCase();
  if (kind === "payment" && value === "paid") return "border-success/30 bg-success/10 text-success";
  if (kind === "payment" && value === "pending") return "border-amber-500/30 bg-amber-500/10 text-amber-600";
  if (value === "approved" || value === "completed" || value === "scheduled") return "border-success/30 bg-success/10 text-success";
  if (value === "rejected" || value === "failed") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-primary/30 bg-primary/10 text-primary";
}

function buildPdfRows(rows: MassIntentionRow[]) {
  return rows.map((row, index) => ({
    no: index + 1,
    offeredFor: getOfferedFor(row),
    type: cleanLabel(row.intention_type),
    details: row.message || row.intention || "-",
    requestedBy: getRequestedBy(row),
    phone: getPhone(row),
    amount: formatTZS(getAmount(row)),
    payment: cleanLabel(row.payment_status),
  }));
}

export default function MassIntentionsPage() {
  const page = useWorkspacePage();
  const { churchId, userRole, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dateFilter, setDateFilter] = useState("");
  const [massTimeFilter, setMassTimeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<MassIntentionRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [totalCount, setTotalCount] = useState(0);

  const canDelete = isSuperAdmin || userRole === "church_admin";
  const filtersKey = [churchId, dateFilter, massTimeFilter, paymentFilter, statusFilter, search.trim()].join("|");
  const pagination = usePaginatedQuery({ totalCount, resetKey: filtersKey });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "mass-intentions-admin",
      churchId,
      dateFilter,
      massTimeFilter,
      paymentFilter,
      statusFilter,
      search,
      pagination.page,
      pagination.pageSize,
    ],
    enabled: !!churchId,
    queryFn: async (): Promise<MassIntentionsPageData> => {
      const [pageResult, churchResult] = await Promise.all([
        supabase.rpc("get_mass_intentions_admin_page" as never, {
          p_church_id: churchId,
          p_search: search.trim() || null,
          p_mass_date: dateFilter || null,
          p_mass_time: massTimeFilter,
          p_payment_status: paymentFilter,
          p_status: statusFilter,
          p_limit: pagination.pageSize,
          p_offset: pagination.from,
        } as never),
        supabase
          .from("churches")
          .select("name, logo_url")
          .eq("id", churchId)
          .maybeSingle(),
      ]);

      if (pageResult.error) throw pageResult.error;
      if (churchResult.error) throw churchResult.error;

      const pageData = pageResult.data as unknown as Omit<MassIntentionsPageData, "church"> | null;

      return {
        rows: (pageData?.rows ?? []) as MassIntentionRow[],
        count: Number(pageData?.count ?? 0),
        summary: {
          today: Number(pageData?.summary?.today ?? 0),
          pendingPayment: Number(pageData?.summary?.pendingPayment ?? 0),
          approved: Number(pageData?.summary?.approved ?? 0),
          collected: Number(pageData?.summary?.collected ?? 0),
        },
        massTimeOptions: (pageData?.massTimeOptions ?? []) as string[],
        church: churchResult.data as ChurchInfo | null,
      };
    },
  });

  const intentions = data?.rows ?? EMPTY_INTENTIONS;
  const church = data?.church ?? null;
  const massTimeOptions = data?.massTimeOptions ?? EMPTY_MASS_TIMES;
  const summary = data?.summary ?? { today: 0, pendingPayment: 0, approved: 0, collected: 0 };
  const toolbarActions = useMemo(() => getWorkspacePageActions("mass_intentions", page), [page]);

  useEffect(() => {
    setTotalCount(data?.count ?? 0);
  }, [data?.count]);

  const upsertIntention = useMutation({
    mutationFn: async (payload: FormState) => {
      if (!churchId) throw new Error("Church context is required.");

      const amount = payload.amount ? Number(payload.amount) : null;
      const rowPayload = {
        church_id: churchId,
        requested_by_name: payload.requested_by_name.trim() || null,
        requested_by_phone: payload.requested_by_phone.trim() || null,
        offered_for_name: payload.offered_for_name.trim() || null,
        intention_type: payload.intention_type,
        message: payload.message.trim(),
        intention: payload.offered_for_name.trim() || payload.message.trim(),
        mass_date: payload.mass_date || null,
        mass_time: payload.mass_time.trim() || null,
        mass_name: payload.mass_name.trim() || null,
        amount,
        offering_amount: amount,
        payment_status: payload.payment_status,
        status: payload.status,
      };

      const query = payload.id
        ? supabase.from("mass_intentions").update(rowPayload).eq("id", payload.id).eq("church_id", churchId)
        : supabase.from("mass_intentions").insert(rowPayload);

      const { data: savedRows, error: saveError } = await query.select("id");
      if (saveError) throw saveError;
      if (!savedRows?.length) throw new Error("Mass intention save was blocked or the row was not found.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mass-intentions-admin"] });
      await queryClient.invalidateQueries({ queryKey: ["mass-intentions"] });
      await queryClient.invalidateQueries({ queryKey: ["portal-mass-intentions"] });
      setFormOpen(false);
      setForm(emptyForm);
      toast({ title: "Mass intention saved" });
    },
    onError: (mutationError: Error) => {
      toast({ title: "Unable to save mass intention", description: mutationError.message, variant: "destructive" });
    },
  });

  const updateIntention = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<Pick<MassIntentionRow, "status" | "payment_status">> }) => {
      if (!churchId) throw new Error("Church context is required.");
      const { data: updatedRows, error: updateError } = await supabase
        .from("mass_intentions")
        .update(values)
        .eq("id", id)
        .eq("church_id", churchId)
        .select("id");

      if (updateError) throw updateError;
      if (!updatedRows?.length) throw new Error("Mass intention update was blocked or the row was not found.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mass-intentions-admin"] });
      await queryClient.invalidateQueries({ queryKey: ["mass-intentions"] });
      await queryClient.invalidateQueries({ queryKey: ["portal-mass-intentions"] });
      toast({ title: "Mass intention updated" });
    },
    onError: (mutationError: Error) => {
      toast({ title: "Unable to update mass intention", description: mutationError.message, variant: "destructive" });
    },
  });

  const deleteIntention = useMutation({
    mutationFn: async (row: MassIntentionRow) => {
      if (!churchId) throw new Error("Church context is required.");
      const { error: deleteError } = await supabase
        .from("mass_intentions")
        .delete()
        .eq("id", row.id)
        .eq("church_id", churchId);

      if (deleteError) throw deleteError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mass-intentions-admin"] });
      toast({ title: "Mass intention deleted" });
    },
    onError: (mutationError: Error) => {
      toast({ title: "Unable to delete mass intention", description: mutationError.message, variant: "destructive" });
    },
  });

  const openAddDialog = () => {
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEditDialog = (row: MassIntentionRow) => {
    setForm({
      id: row.id,
      requested_by_name: row.requested_by_name || row.members?.full_name || "",
      requested_by_phone: row.requested_by_phone || row.members?.phone || "",
      offered_for_name: getOfferedFor(row),
      intention_type: row.intention_type || "thanksgiving",
      message: row.message || row.intention || "",
      mass_date: row.mass_date || "",
      mass_time: row.mass_time || "",
      mass_name: row.mass_name || "",
      amount: getAmount(row) ? String(getAmount(row)) : "",
      payment_status: row.payment_status || "pending",
      status: row.status || "pending",
    });
    setFormOpen(true);
  };

  const generatePdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const rows = buildPdfRows(intentions);
    const totalPaid = intentions
      .filter((row) => row.payment_status === "paid")
      .reduce((total, row) => total + getAmount(row), 0);
    const titleDate = dateFilter || "Current filtered table";
    const titleMassTime = massTimeFilter === "all" ? "All Masses" : massTimeFilter;
    const columnWidths = [28, 100, 88, 185, 100, 82, 80, 82];
    const headers = ["No.", "Offered For", "Intention Type", "Intention Details", "Requested By", "Phone", "Amount", "Payment"];
    let pageNumber = 1;
    let y = 126;

    const drawHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(church?.name || "Church", margin, 42);
      doc.setFontSize(13);
      doc.text("Mass Intentions List", margin, 64);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Date: ${titleDate}`, margin, 84);
      doc.text(`Mass time: ${titleMassTime}`, margin + 180, 84);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, margin + 380, 84);

      if (church?.logo_url?.startsWith("data:image")) {
        try {
          doc.addImage(church.logo_url, "PNG", pageWidth - margin - 48, 30, 42, 42);
        } catch {
          // Logo is optional and should not block PDF generation.
        }
      }

      doc.setFillColor(245, 245, 245);
      doc.rect(margin, 104, pageWidth - margin * 2, 20, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      let x = margin + 4;
      headers.forEach((header, index) => {
        doc.text(header, x, 117);
        x += columnWidths[index];
      });
      doc.setFont("helvetica", "normal");
      y = 140;
    };

    const drawFooter = () => {
      doc.setFontSize(8);
      doc.text(`Page ${pageNumber}`, pageWidth - margin - 36, pageHeight - 20);
    };

    drawHeader();

    rows.forEach((row) => {
      const cells = [
        String(row.no),
        row.offeredFor,
        row.type,
        row.details,
        row.requestedBy,
        row.phone,
        row.amount,
        row.payment,
      ];
      const lineCounts = cells.map((cell, index) => doc.splitTextToSize(cell, columnWidths[index] - 8).length);
      const rowHeight = Math.max(24, Math.max(...lineCounts) * 10 + 10);

      if (y + rowHeight > pageHeight - 58) {
        drawFooter();
        doc.addPage();
        pageNumber += 1;
        drawHeader();
      }

      let x = margin;
      doc.setDrawColor(220, 220, 220);
      doc.rect(margin, y - 14, pageWidth - margin * 2, rowHeight);
      cells.forEach((cell, index) => {
        const lines = doc.splitTextToSize(cell, columnWidths[index] - 8);
        doc.text(lines, x + 4, y);
        x += columnWidths[index];
      });
      y += rowHeight;
    });

    if (y + 36 > pageHeight - 58) {
      drawFooter();
      doc.addPage();
      pageNumber += 1;
      drawHeader();
    }

    doc.setFont("helvetica", "bold");
    doc.text(`Total intentions: ${rows.length}`, margin, y + 18);
    doc.text(`Total paid amount: ${formatTZS(totalPaid)}`, margin + 180, y + 18);
    drawFooter();
    doc.save(`mass-intentions-${dateFilter || "filtered"}.pdf`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageToolbar
        title="Mass Intentions"
        description="Review Mass intentions in the active workspace while reusing the same office list."
        actions={toolbarActions}
      />
      {(page.permissions.has("export") || page.permissions.has("create")) ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {page.permissions.has("export") ? (
            <Button variant="outline" onClick={generatePdf} disabled={intentions.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Generate PDF
            </Button>
          ) : null}
          {page.permissions.has("create") ? (
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Manual
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="glass-card"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Total intentions today</p><p className="mt-2 text-2xl font-bold font-serif">{summary.today}</p></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Pending payment</p><p className="mt-2 text-2xl font-bold font-serif">{summary.pendingPayment}</p></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Approved</p><p className="mt-2 text-2xl font-bold font-serif">{summary.approved}</p></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Total amount collected</p><p className="mt-2 text-2xl font-bold font-serif">{formatTZS(summary.collected)}</p></CardContent></Card>
      </div>

      <Card className="glass-card">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <Label htmlFor="mass-date">Date</Label>
            <Input id="mass-date" type="date" className="mt-2" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </div>
          <div>
            <Label>Mass time</Label>
            <Select value={massTimeFilter} onValueChange={setMassTimeFilter}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="All Masses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Masses</SelectItem>
                {massTimeOptions.map((time) => <SelectItem key={time} value={time}>{time}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment status</Label>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Approval/status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="mass-search">Search</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="mass-search"
                className="pl-9"
                placeholder="Name, phone, offered for"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Mass time / Mass name</TableHead>
                  <TableHead>Offered For</TableHead>
                  <TableHead>Intention type</TableHead>
                  <TableHead>Intention message/details</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Phone number</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment status</TableHead>
                  <TableHead>Approval/status</TableHead>
                  <TableHead>Created date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-12 text-center text-destructive">
                      {(error as Error)?.message || "Mass intentions could not be loaded."}
                    </TableCell>
                  </TableRow>
                ) : intentions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">
                      <Flame className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                      No mass intentions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  intentions.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm">{formatDate(row.mass_date)}</TableCell>
                      <TableCell className="min-w-36 text-sm">{row.mass_time || row.mass_name || "-"}</TableCell>
                      <TableCell className="min-w-36 font-medium">{getOfferedFor(row)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{cleanLabel(row.intention_type)}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground" title={row.message || row.intention || undefined}>
                        {row.message || row.intention || "-"}
                      </TableCell>
                      <TableCell className="min-w-32 text-sm">{getRequestedBy(row)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{getPhone(row)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatTZS(getAmount(row))}</TableCell>
                      <TableCell><Badge variant="outline" className={badgeClass(row.payment_status || "pending", "payment")}>{cleanLabel(row.payment_status || "pending")}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={badgeClass(row.status || "pending", "approval")}>{cleanLabel(row.status || "pending")}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex min-w-72 flex-wrap gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedRow(row)}><Eye className="mr-1 h-4 w-4" />View</Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(row)}><FilePenLine className="mr-1 h-4 w-4" />Edit</Button>
                          <Button variant="ghost" size="sm" disabled={updateIntention.isPending || row.status === "approved"} onClick={() => updateIntention.mutate({ id: row.id, values: { status: "approved" } })}><Check className="mr-1 h-4 w-4" />Approve</Button>
                          <Button variant="ghost" size="sm" disabled={updateIntention.isPending || row.payment_status === "paid"} onClick={() => updateIntention.mutate({ id: row.id, values: { payment_status: "paid" } })}>Mark paid</Button>
                          <Button variant="ghost" size="sm" disabled={updateIntention.isPending || row.status === "completed"} onClick={() => updateIntention.mutate({ id: row.id, values: { status: "completed" } })}>Complete</Button>
                          {canDelete && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={deleteIntention.isPending} onClick={() => deleteIntention.mutate(row)}>
                              <Trash2 className="mr-1 h-4 w-4" />Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationFooter
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            hasPreviousPage={pagination.hasPreviousPage}
            hasNextPage={pagination.hasNextPage}
            previousPage={pagination.previousPage}
            nextPage={pagination.nextPage}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mass intention details</DialogTitle>
            <DialogDescription>Full submitted details for church office review.</DialogDescription>
          </DialogHeader>
          {selectedRow && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Offered For" value={getOfferedFor(selectedRow)} />
              <Detail label="Requested By" value={getRequestedBy(selectedRow)} />
              <Detail label="Phone" value={getPhone(selectedRow)} />
              <Detail label="Mass" value={selectedRow.mass_time || selectedRow.mass_name || "-"} />
              <Detail label="Date" value={formatDate(selectedRow.mass_date)} />
              <Detail label="Amount" value={formatTZS(getAmount(selectedRow))} />
              <Detail label="Payment Status" value={cleanLabel(selectedRow.payment_status || "pending")} />
              <Detail label="Status" value={cleanLabel(selectedRow.status || "pending")} />
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Intention details</p>
                <p className="mt-1 rounded-lg border border-border/60 bg-secondary/20 p-3">{selectedRow.message || selectedRow.intention || "-"}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit mass intention" : "Add manual mass intention"}</DialogTitle>
            <DialogDescription>Record office-submitted intentions or correct submitted details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Requested by"><Input value={form.requested_by_name} onChange={(event) => setForm({ ...form, requested_by_name: event.target.value })} /></Field>
            <Field label="Phone number"><Input value={form.requested_by_phone} onChange={(event) => setForm({ ...form, requested_by_phone: event.target.value })} /></Field>
            <Field label="Offered for"><Input value={form.offered_for_name} onChange={(event) => setForm({ ...form, offered_for_name: event.target.value })} /></Field>
            <Field label="Intention type">
              <Select value={form.intention_type} onValueChange={(value) => setForm({ ...form, intention_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {intentionTypes.map((type) => <SelectItem key={type} value={type}>{cleanLabel(type)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mass date"><Input type="date" value={form.mass_date} onChange={(event) => setForm({ ...form, mass_date: event.target.value })} /></Field>
            <Field label="Mass time"><Input value={form.mass_time} placeholder="06:00 AM" onChange={(event) => setForm({ ...form, mass_time: event.target.value })} /></Field>
            <Field label="Mass name"><Input value={form.mass_name} placeholder="Morning Mass" onChange={(event) => setForm({ ...form, mass_name: event.target.value })} /></Field>
            <Field label="Amount"><Input type="number" min="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field>
            <Field label="Payment status">
              <Select value={form.payment_status} onValueChange={(value) => setForm({ ...form, payment_status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Approval/status">
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Label>Intention message/details</Label>
              <Textarea className="mt-2 min-h-28" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => upsertIntention.mutate(form)} disabled={upsertIntention.isPending || !form.message.trim()}>
              {upsertIntention.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
