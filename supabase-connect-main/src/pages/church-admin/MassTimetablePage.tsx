import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
import { CalendarDays, Loader2, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  MASS_WEEKDAYS,
  TIMETABLE_ACTIVITY_LABEL_KEYS,
  TIMETABLE_ACTIVITY_TYPES,
  formatMassDate,
  formatMassTime,
  validateMassTimes,
  type MassOccurrence,
  type MassSchedule,
  type TimetableActivityClassification,
  type TimetableActivityType,
} from "@/lib/mass-timetable";

const db = supabase as unknown as SupabaseClient;
const tzDate = (days = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(
    new Date(Date.now() + days * 86400000),
  );

type ScheduleForm = {
  id?: string;
  name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  location_name: string;
  language: string;
  default_celebrant_name: string;
  intention_capacity: string;
  default_intention_fee: string;
  accepts_intentions: boolean;
  effective_from: string;
  effective_until: string;
  is_active: boolean;
  activity_type: TimetableActivityType | "";
  original_activity_type?: TimetableActivityClassification;
};

const emptyForm = (): ScheduleForm => ({
  name: "",
  day_of_week: "0",
  start_time: "06:30",
  end_time: "",
  location_name: "",
  language: "Kiswahili",
  default_celebrant_name: "",
  intention_capacity: "",
  default_intention_fee: "",
  accepts_intentions: true,
  effective_from: tzDate(),
  effective_until: "",
  is_active: true,
  activity_type: "mass",
});

const isActivityType = (value: string): value is TimetableActivityType =>
  TIMETABLE_ACTIVITY_TYPES.includes(value as TimetableActivityType);

const activityKey = (value?: TimetableActivityClassification) =>
  value ? TIMETABLE_ACTIVITY_LABEL_KEYS[value] : TIMETABLE_ACTIVITY_LABEL_KEYS.unclassified;

const isMissingActivityTypeColumn = (error: Error) =>
  error.message.toLowerCase().includes("activity_type") && error.message.toLowerCase().includes("column");

const isMissingActivityClassificationRpc = (error: Error) => {
  const message = error.message.toLowerCase();
  return message.includes("classify_mass_schedule_activity") || message.includes("could not find the function");
};

const isBlockedByFutureIntentions = (error: Error) =>
  error.message.toLowerCase().includes("future occurrences already have mass intentions");

export default function MassTimetablePage() {
  const { t } = useTranslation();
  const { churchId } = useAuth();
  const { toast } = useToast();
  const client = useQueryClient();
  const [form, setForm] = useState<ScheduleForm | null>(null);

  const timetable = useQuery({
    queryKey: ["wave4a-mass-timetable", churchId],
    enabled: !!churchId,
    queryFn: async () => {
      const [schedules, occurrences] = await Promise.all([
        db.from("mass_schedules").select("*").eq("church_id", churchId).order("day_of_week").order("start_time"),
        db
          .from("mass_occurrences")
          .select("*")
          .eq("church_id", churchId)
          .gte("occurrence_date", tzDate())
          .lte("occurrence_date", tzDate(90))
          .order("occurrence_date")
          .order("start_time"),
      ]);

      if (schedules.error) throw schedules.error;
      if (occurrences.error) throw occurrences.error;

      return { schedules: schedules.data as MassSchedule[], occurrences: occurrences.data as MassOccurrence[] };
    },
  });

  const refresh = () => client.invalidateQueries({ queryKey: ["wave4a-mass-timetable", churchId] });

  const generate = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error(t("mass_timetable_admin.errors.no_church"));
      const result = await db.rpc("generate_mass_occurrences", {
        p_church_id: churchId,
        p_start_date: tzDate(),
        p_end_date: tzDate(90),
      });
      if (result.error) throw result.error;
      return Number(result.data ?? 0);
    },
    onSuccess: (count) => {
      refresh();
      toast({
        title: t("mass_timetable_admin.toasts.generated.title"),
        description: t("mass_timetable_admin.toasts.generated.description", { count }),
      });
    },
    onError: (error: Error) =>
      toast({ title: t("mass_timetable_admin.toasts.generate_failed"), description: error.message, variant: "destructive" }),
  });

  const save = useMutation({
    mutationFn: async (value: ScheduleForm) => {
      if (!churchId) throw new Error(t("mass_timetable_admin.errors.no_church"));
      if (!value.name.trim() || !validateMassTimes(value.start_time, value.end_time)) {
        throw new Error(t("mass_timetable_admin.errors.invalid_form"));
      }
      if (!isActivityType(value.activity_type)) {
        throw new Error(t("mass_timetable_admin.errors.activity_required"));
      }

      const activity_type = value.activity_type;
      const scheduleFields = {
        church_id: churchId,
        name: value.name.trim(),
        day_of_week: Number(value.day_of_week),
        start_time: value.start_time,
        end_time: value.end_time || null,
        location_name: value.location_name.trim() || null,
        language: value.language.trim() || null,
        default_celebrant_name: value.default_celebrant_name.trim() || null,
        intention_capacity: value.intention_capacity === "" ? null : Number(value.intention_capacity),
        default_intention_fee: value.default_intention_fee === "" ? null : Number(value.default_intention_fee),
        accepts_intentions: value.accepts_intentions,
        effective_from: value.effective_from,
        effective_until: value.effective_until || null,
        is_active: value.is_active,
      };

      if (value.id) {
        const result = await db.from("mass_schedules").update(scheduleFields).eq("id", value.id).eq("church_id", churchId);
        if (result.error) throw result.error;

        if (value.original_activity_type !== activity_type) {
          const classificationResult = await db.rpc("classify_mass_schedule_activity", {
            p_church_id: churchId,
            p_schedule_id: value.id,
            p_activity_type: activity_type,
          });

          if (classificationResult.error) throw classificationResult.error;
        }
      } else {
        const result = await db.from("mass_schedules").insert({ ...scheduleFields, activity_type });
        if (result.error) throw result.error;
      }
    },
    onSuccess: () => {
      setForm(null);
      refresh();
      toast({ title: t("mass_timetable_admin.toasts.saved") });
    },
    onError: (error: Error) =>
      toast({
        title: t("mass_timetable_admin.toasts.save_failed"),
        description: isMissingActivityTypeColumn(error) || isMissingActivityClassificationRpc(error)
          ? t("mass_timetable_admin.errors.migration_required")
          : isBlockedByFutureIntentions(error)
            ? t("mass_timetable_admin.errors.classification_blocked_by_intentions")
            : error.message,
        variant: "destructive",
      }),
  });

  const toggle = useMutation({
    mutationFn: async (row: MassSchedule) => {
      const result = await db.from("mass_schedules").update({ is_active: !row.is_active }).eq("id", row.id).eq("church_id", churchId);
      if (result.error) throw result.error;
    },
    onSuccess: refresh,
  });

  const openEdit = (row: MassSchedule) =>
    setForm({
      id: row.id,
      name: row.name,
      day_of_week: String(row.day_of_week),
      start_time: formatMassTime(row.start_time),
      end_time: row.end_time ? formatMassTime(row.end_time) : "",
      location_name: row.location_name ?? "",
      language: row.language ?? "",
      default_celebrant_name: row.default_celebrant_name ?? "",
      intention_capacity: row.intention_capacity == null ? "" : String(row.intention_capacity),
      default_intention_fee: row.default_intention_fee == null ? "" : String(row.default_intention_fee),
      accepts_intentions: row.accepts_intentions,
      effective_from: row.effective_from,
      effective_until: row.effective_until ?? "",
      is_active: row.is_active,
      activity_type: row.activity_type ?? "",
      original_activity_type: row.activity_type ?? null,
    });

  const renderActivityBadge = (activityType?: TimetableActivityClassification) => (
    <Badge variant={activityType ? "outline" : "destructive"}>{t(activityKey(activityType))}</Badge>
  );

  return (
    <div className="space-y-6" data-testid="mass-timetable-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">{t("mass_timetable_admin.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("mass_timetable_admin.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setForm(emptyForm())}>
            <Plus className="mr-2 h-4 w-4" />
            {t("mass_timetable_admin.actions.add")}
          </Button>
          <Button variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("mass_timetable_admin.actions.generate")}
          </Button>
        </div>
      </div>

      {timetable.isLoading ? (
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      ) : timetable.isError ? (
        <Card>
          <CardContent className="p-6 text-destructive">{t("mass_timetable_admin.errors.load_failed")}</CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {timetable.data?.schedules.map((row) => (
              <Card key={row.id}>
                <CardHeader>
                  <CardTitle className="flex justify-between gap-2 text-base">
                    <span>{row.name}</span>
                    <Badge variant={row.is_active ? "default" : "secondary"}>
                      {row.is_active ? t("mass_timetable_admin.status.active") : t("mass_timetable_admin.status.inactive")}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2">{renderActivityBadge(row.activity_type ?? null)}</div>
                  <p>
                    {MASS_WEEKDAYS[row.day_of_week]} - {formatMassTime(row.start_time)} - {row.location_name || t("mass_timetable_admin.default_location")}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                      {t("mass_timetable_admin.actions.edit")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggle.mutate(row)}>
                      {row.is_active ? t("mass_timetable_admin.actions.disable") : t("mass_timetable_admin.actions.enable")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" />
                {t("mass_timetable_admin.upcoming_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {timetable.data?.occurrences.length ? (
                timetable.data.occurrences.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <span>
                      <strong>{row.name}</strong> - {formatMassDate(row.occurrence_date)} {formatMassTime(row.start_time)}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {renderActivityBadge(row.activity_type ?? null)}
                      <Badge variant={row.status === "cancelled" ? "destructive" : "outline"}>{row.status}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-muted-foreground">{t("mass_timetable_admin.empty_occurrences")}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? t("mass_timetable_admin.dialogs.edit") : t("mass_timetable_admin.dialogs.new")}</DialogTitle>
          </DialogHeader>
          {form && (
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save.mutate(form); }}>
              <Field label={t("mass_timetable_admin.fields.name")}>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label={t("mass_timetable_admin.fields.activity_type")}>
                <Select value={form.activity_type} onValueChange={(value) => setForm({ ...form, activity_type: value as TimetableActivityType })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("mass_timetable_admin.placeholders.activity_type")} />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMETABLE_ACTIVITY_TYPES.map((activityType) => (
                      <SelectItem key={activityType} value={activityType}>
                        {t(TIMETABLE_ACTIVITY_LABEL_KEYS[activityType])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("mass_timetable_admin.fields.day")}>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={form.day_of_week}
                  onChange={(event) => setForm({ ...form, day_of_week: event.target.value })}
                >
                  {MASS_WEEKDAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("mass_timetable_admin.fields.start_time")}>
                <Input type="time" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} />
              </Field>
              <Field label={t("mass_timetable_admin.fields.end_time")}>
                <Input type="time" value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} />
              </Field>
              <Field label={t("mass_timetable_admin.fields.location")}>
                <Input value={form.location_name} onChange={(event) => setForm({ ...form, location_name: event.target.value })} />
              </Field>
              <Field label={t("mass_timetable_admin.fields.language")}>
                <Input value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} />
              </Field>
              <Field label={t("mass_timetable_admin.fields.capacity")}>
                <Input type="number" min="0" value={form.intention_capacity} onChange={(event) => setForm({ ...form, intention_capacity: event.target.value })} />
              </Field>
              <Field label={t("mass_timetable_admin.fields.fee")}>
                <Input type="number" min="0" value={form.default_intention_fee} onChange={(event) => setForm({ ...form, default_intention_fee: event.target.value })} />
              </Field>
              <Field label={t("mass_timetable_admin.fields.effective_from")}>
                <Input type="date" value={form.effective_from} onChange={(event) => setForm({ ...form, effective_from: event.target.value })} />
              </Field>
              <Field label={t("mass_timetable_admin.fields.effective_until")}>
                <Input type="date" value={form.effective_until} onChange={(event) => setForm({ ...form, effective_until: event.target.value })} />
              </Field>
              <div className="flex items-center gap-2">
                <Switch checked={form.accepts_intentions} onCheckedChange={(value) => setForm({ ...form, accepts_intentions: value })} />
                <Label>{t("mass_timetable_admin.fields.accepts_intentions")}</Label>
              </div>
              <Button className="sm:col-span-2" type="submit" disabled={save.isPending}>
                {t("mass_timetable_admin.actions.save")}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
