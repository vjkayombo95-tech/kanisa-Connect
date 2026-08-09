import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  CalendarDays,
  FileDown,
  FileText,
  Loader2,
  Plus,
  Search,
  Upload,
  Users,
} from "lucide-react";

import { PageToolbar } from "@/components/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  buildSacramentalTimeline,
  downloadSacramentCertificate,
  sacramentLabel,
  sacramentOptions,
  sacramentShortLabel,
  sacramentStatusClass,
  sacramentStatusLabel,
  sacramentStatusOptions,
  summarizeSacraments,
  type SacramentalRecord,
  type SacramentStatus,
  type SacramentType,
} from "@/lib/sacraments";

type MemberOption = {
  id: string;
  full_name: string;
  email?: string | null;
};

type SacramentForm = {
  id: string | null;
  memberId: string;
  sacramentType: SacramentType;
  status: SacramentStatus;
  sacramentDate: string;
  minister: string;
  location: string;
  certificateNumber: string;
  registerPage: string;
  sponsors: string;
  witnesses: string;
  parents: string;
  spouse: string;
  preparation: string;
  notes: string;
  documents: SacramentalRecord["documents"];
};

const EMPTY_FORM: SacramentForm = {
  id: null,
  memberId: "",
  sacramentType: "baptism",
  status: "planned",
  sacramentDate: "",
  minister: "",
  location: "",
  certificateNumber: "",
  registerPage: "",
  sponsors: "",
  witnesses: "",
  parents: "",
  spouse: "",
  preparation: "",
  notes: "",
  documents: [],
};

function toLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function fromLocalDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function linesToArray(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

function textToObject(value: string) {
  if (!value.trim()) return {};
  return value
    .split("\n")
    .map((line) => line.split(":").map((part) => part.trim()))
    .filter(([key, val]) => key && val)
    .reduce<Record<string, string>>((record, [key, val]) => ({ ...record, [key]: val }), {});
}

function objectToText(value: Record<string, unknown> | null | undefined) {
  return Object.entries(value ?? {})
    .map(([key, val]) => `${key}: ${String(val)}`)
    .join("\n");
}

function arrayToLines(value: unknown[] | null | undefined) {
  return (value ?? [])
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item) return String(item.name ?? "");
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export default function SacramentsPage() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SacramentForm>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<SacramentType | "all">("all");
  const [file, setFile] = useState<File | null>(null);

  const { data: church } = useQuery({
    queryKey: ["sacraments-church", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data, error } = await supabase.from("churches").select("name").eq("id", churchId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(churchId),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["sacrament-members", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("members")
        .select("id,full_name,email")
        .eq("church_id", churchId)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MemberOption[];
    },
    enabled: Boolean(churchId),
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["sacramental-records", churchId, search],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase.rpc("get_sacramental_records" as never, {
        _church_id: churchId,
        _search: search || null,
      } as never);
      if (error) throw error;
      return (data ?? []) as SacramentalRecord[];
    },
    enabled: Boolean(churchId),
  });

  const filteredRecords = useMemo(
    () => records.filter((record) => typeFilter === "all" || record.sacrament_type === typeFilter),
    [records, typeFilter],
  );
  const summary = useMemo(() => summarizeSacraments(filteredRecords), [filteredRecords]);
  const timelines = useMemo(() => {
    const grouped = new Map<string, SacramentalRecord[]>();
    filteredRecords.forEach((record) => {
      if (!record.member_id) return;
      grouped.set(record.member_id, [...(grouped.get(record.member_id) ?? []), record]);
    });
    return Array.from(grouped.entries()).slice(0, 8);
  }, [filteredRecords]);

  const openCreate = (type: SacramentType = "baptism") => {
    setForm({ ...EMPTY_FORM, sacramentType: type });
    setFile(null);
    setDialogOpen(true);
  };

  const openEdit = (record: SacramentalRecord) => {
    setForm({
      id: record.id,
      memberId: record.member_id ?? "",
      sacramentType: record.sacrament_type,
      status: record.status,
      sacramentDate: toLocalDateTime(record.sacrament_date),
      minister: record.minister ?? "",
      location: record.location ?? "",
      certificateNumber: record.certificate_number ?? "",
      registerPage: record.register_page ?? "",
      sponsors: arrayToLines(record.sponsors),
      witnesses: arrayToLines(record.witnesses),
      parents: objectToText(record.parents),
      spouse: objectToText(record.spouse),
      preparation: objectToText(record.preparation),
      notes: record.notes ?? "",
      documents: record.documents ?? [],
    });
    setFile(null);
    setDialogOpen(true);
  };

  const saveRecord = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      let documents = form.documents;
      if (file) {
        const storagePath = `${churchId}/sacraments/${form.id ?? Date.now()}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("church-assets")
          .upload(storagePath, file, { upsert: true, contentType: file.type || undefined });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("church-assets").getPublicUrl(storagePath);
        documents = [
          ...documents,
          { name: file.name, path: storagePath, url: data.publicUrl, type: file.type, uploadedAt: new Date().toISOString() },
        ];
      }

      const { data, error } = await supabase.rpc("save_sacramental_record" as never, {
        _record_id: form.id,
        _church_id: churchId,
        _member_id: form.memberId || null,
        _sacrament_type: form.sacramentType,
        _status: form.status,
        _sacrament_date: fromLocalDateTime(form.sacramentDate),
        _minister: form.minister,
        _location: form.location,
        _certificate_number: form.certificateNumber,
        _register_page: form.registerPage,
        _sponsors: linesToArray(form.sponsors),
        _witnesses: linesToArray(form.witnesses),
        _parents: textToObject(form.parents),
        _spouse: textToObject(form.spouse),
        _preparation: textToObject(form.preparation),
        _documents: documents,
        _notes: form.notes,
      } as never);
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || "Sacramental record save failed.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sacramental-records"] });
      queryClient.invalidateQueries({ queryKey: ["parish-calendar-events"] });
      toast({ title: form.id ? "Sacrament updated" : "Sacrament recorded" });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setFile(null);
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const upcoming = filteredRecords
    .filter((record) => record.sacrament_date && new Date(record.sacrament_date) >= new Date())
    .sort((a, b) => new Date(a.sacrament_date ?? 0).getTime() - new Date(b.sacrament_date ?? 0).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageToolbar
        title="Sacraments"
        description="Manage sacramental journeys, certificates, preparation, reports, and parish calendar visibility."
        actions={[{ id: "new-sacrament", label: "New Record", icon: Plus, onClick: () => openCreate() }]}
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {["overview", "baptism", "first_communion", "confirmation", "marriage", "funeral", "rcia", "certificates", "reports", "settings"].map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab === "first_communion" ? "Communion" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            <Metric title="Total Records" value={summary.total} icon={FileText} />
            <Metric title="Upcoming" value={summary.upcoming} icon={CalendarDays} />
            <Metric title="This Year" value={summary.thisYear} icon={Users} />
            <Metric title="Pending Certificates" value={summary.pendingCertificates} icon={Award} />
          </section>
          <Filters search={search} setSearch={setSearch} typeFilter={typeFilter} setTypeFilter={setTypeFilter} />
          <section className="grid gap-6 xl:grid-cols-[1.4fr,0.8fr]">
            <RecordList records={filteredRecords} isLoading={isLoading} onEdit={openEdit} churchName={church?.name} />
            <div className="space-y-6">
              <UpcomingCard records={upcoming} />
              <TimelineCard timelines={timelines} members={members} />
            </div>
          </section>
        </TabsContent>

        {sacramentOptions.map((option) => (
          <TabsContent key={option.value} value={option.value} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">{option.label}</h2>
                <p className="text-sm text-muted-foreground">Records, preparation, certificates, and pastoral notes.</p>
              </div>
              <Button onClick={() => openCreate(option.value)}>
                <Plus className="mr-2 h-4 w-4" />
                New {option.shortLabel}
              </Button>
            </div>
            <RecordList
              records={filteredRecords.filter((record) => record.sacrament_type === option.value)}
              isLoading={isLoading}
              onEdit={openEdit}
              churchName={church?.name}
            />
          </TabsContent>
        ))}

        <TabsContent value="certificates" className="space-y-4">
          <RecordList
            records={filteredRecords.filter((record) => record.status === "certificate_ready" || record.status === "certificate_issued" || record.certificate_number)}
            isLoading={isLoading}
            onEdit={openEdit}
            churchName={church?.name}
          />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summary.byType.map((item) => (
              <Card key={item.type} className="glass-card">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold">{item.count}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.thisYear} this year</p>
                </CardContent>
              </Card>
            ))}
          </section>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-serif">Sacramental Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Certificate numbers, register pages, QR verification, and seal/signature placeholders are managed per record.</p>
              <p>Holy Orders is available as future-ready record type for diocesan extension.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{form.id ? "Edit Sacrament" : "New Sacrament"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveRecord.mutate();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Member</Label>
                <Select value={form.memberId || "none"} onValueChange={(value) => setForm((current) => ({ ...current, memberId: value === "none" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked member yet</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SelectField label="Sacrament" value={form.sacramentType} onChange={(value) => setForm((current) => ({ ...current, sacramentType: value as SacramentType }))} options={sacramentOptions.map((option) => ({ value: option.value, label: option.label }))} />
              <SelectField label="Status" value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value as SacramentStatus }))} options={sacramentStatusOptions} />
              <div className="space-y-2">
                <Label>Date and time</Label>
                <Input type="datetime-local" value={form.sacramentDate} onChange={(event) => setForm((current) => ({ ...current, sacramentDate: event.target.value }))} />
              </div>
              <TextField label="Minister" value={form.minister} onChange={(minister) => setForm((current) => ({ ...current, minister }))} />
              <TextField label="Location" value={form.location} onChange={(location) => setForm((current) => ({ ...current, location }))} />
              <TextField label="Certificate Number" value={form.certificateNumber} onChange={(certificateNumber) => setForm((current) => ({ ...current, certificateNumber }))} />
              <TextField label="Register Page" value={form.registerPage} onChange={(registerPage) => setForm((current) => ({ ...current, registerPage }))} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextAreaField label="Sponsors / Godparents" helper="One name per line" value={form.sponsors} onChange={(sponsors) => setForm((current) => ({ ...current, sponsors }))} />
              <TextAreaField label="Witnesses" helper="Marriage witnesses, one per line" value={form.witnesses} onChange={(witnesses) => setForm((current) => ({ ...current, witnesses }))} />
              <TextAreaField label="Parents" helper="Use key: value, one per line" value={form.parents} onChange={(parents) => setForm((current) => ({ ...current, parents }))} />
              <TextAreaField label="Spouse" helper="Use key: value, one per line" value={form.spouse} onChange={(spouse) => setForm((current) => ({ ...current, spouse }))} />
            </div>
            <TextAreaField label="Preparation" helper="Class, session, catechist, checklist notes" value={form.preparation} onChange={(preparation) => setForm((current) => ({ ...current, preparation }))} />
            <TextAreaField label="Notes" value={form.notes} onChange={(notes) => setForm((current) => ({ ...current, notes }))} />
            <div className="space-y-2">
              <Label>Supporting Document</Label>
              <Input type="file" accept="image/*,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground">Scanned certificates, marriage license, photos, or supporting PDFs are stored in church assets.</p>
              {form.documents.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.documents.map((document) => (
                    <Badge key={`${document.name}-${document.uploadedAt}`} variant="outline">
                      {document.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveRecord.isPending}>
                {saveRecord.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Record
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: number; icon: typeof FileText }) {
  return (
    <Card className="glass-card">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
        <Icon className="h-6 w-6 text-primary" />
      </CardContent>
    </Card>
  );
}

function Filters({
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
}: {
  search: string;
  setSearch: (value: string) => void;
  typeFilter: SacramentType | "all";
  setTypeFilter: (value: SacramentType | "all") => void;
}) {
  return (
    <Card className="glass-card">
      <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search certificate, member, parents, spouse, minister, register page..." />
        </div>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as SacramentType | "all")}>
          <SelectTrigger>
            <SelectValue placeholder="All sacraments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sacraments</SelectItem>
            {sacramentOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

function RecordList({
  records,
  isLoading,
  onEdit,
  churchName,
}: {
  records: SacramentalRecord[];
  isLoading: boolean;
  onEdit: (record: SacramentalRecord) => void;
  churchName?: string | null;
}) {
  if (isLoading) {
    return <Card className="glass-card"><CardContent className="py-12 text-center text-muted-foreground">Loading sacramental records...</CardContent></Card>;
  }
  if (records.length === 0) {
    return <Card className="glass-card"><CardContent className="py-12 text-center text-muted-foreground">No sacramental records match this view.</CardContent></Card>;
  }
  return (
    <div className="space-y-3">
      {records.map((record) => (
        <Card key={record.id} className="glass-card">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{sacramentLabel(record.sacrament_type)}</h3>
                <Badge variant="outline" className={sacramentStatusClass(record.status)}>
                  {sacramentStatusLabel(record.status)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{record.member_name || "No linked member"} {record.sacrament_date ? `- ${new Date(record.sacrament_date).toLocaleString()}` : ""}</p>
              <p className="text-xs text-muted-foreground">
                Certificate {record.certificate_number || "pending"} - Register {record.register_page || "pending"} - Minister {record.minister || "not set"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(record)}>
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadSacramentCertificate(record, churchName)}>
                <FileDown className="mr-2 h-4 w-4" />
                Certificate
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UpcomingCard({ records }: { records: SacramentalRecord[] }) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="font-serif">Upcoming Sacraments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming sacramental celebrations scheduled.</p>
        ) : (
          records.map((record) => (
            <div key={record.id} className="rounded-lg border border-border/60 p-3">
              <p className="font-medium">{sacramentShortLabel(record.sacrament_type)} - {record.member_name || "Unlinked member"}</p>
              <p className="text-xs text-muted-foreground">{record.sacrament_date ? new Date(record.sacrament_date).toLocaleString() : "Date pending"}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TimelineCard({ timelines, members }: { timelines: Array<[string, SacramentalRecord[]]>; members: MemberOption[] }) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="font-serif">Member Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {timelines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sacramental milestones linked to members will appear here.</p>
        ) : (
          timelines.map(([memberId, records]) => {
            const memberName = members.find((member) => member.id === memberId)?.full_name ?? records[0]?.member_name ?? "Member";
            return (
              <div key={memberId} className="space-y-2">
                <p className="font-medium">{memberName}</p>
                <ol className="space-y-2 border-l border-border pl-4">
                  {buildSacramentalTimeline(records).map((item) => (
                    <li key={item.id} className="text-sm">
                      <span className="font-medium">{item.year ?? "Future"}</span> - {item.title}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TextAreaField({ label, helper, value, onChange }: { label: string; helper?: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
