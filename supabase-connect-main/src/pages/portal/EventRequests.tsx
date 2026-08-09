import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { translateEventRequestType, translateStatus } from "@/lib/translation-helpers";
import { useTranslation } from "react-i18next";

const REQUEST_TYPES = [
  "parish_event",
  "ministry_group_event",
  "special_mass_request",
  "venue_facility_request",
  "prayer_formation_event",
  "other",
] as const;

type RequestType = (typeof REQUEST_TYPES)[number];

type FormState = {
  requestType: RequestType | "";
  title: string;
  description: string;
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  locationPreference: string;
  expectedAttendance: string;
  ministryId: string;
  communityId: string;
  requesterPhone: string;
  additionalNotes: string;
};

const emptyForm: FormState = {
  requestType: "",
  title: "",
  description: "",
  preferredDate: "",
  preferredStartTime: "",
  preferredEndTime: "",
  locationPreference: "",
  expectedAttendance: "",
  ministryId: "",
  communityId: "",
  requesterPhone: "",
  additionalNotes: "",
};

function normalizeDate(value: string) {
  return value ? new Date(value).toISOString().split("T")[0] : "";
}

export default function EventRequests() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { user, churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const memberQuery = useQuery({
    queryKey: ["event-request-member", user?.id, user?.email, churchId],
    queryFn: async () => {
      if (!user || !churchId) return null;

      const { data: linkedMember, error: linkedError } = await supabase
        .from("members")
        .select("id, full_name, email, phone")
        .eq("user_id", user.id)
        .eq("church_id", churchId)
        .maybeSingle();

      if (linkedError) throw linkedError;
      if (linkedMember) return linkedMember;
      if (!user.email) return null;

      const { data: emailMember, error: emailError } = await supabase
        .from("members")
        .select("id, full_name, email, phone")
        .eq("church_id", churchId)
        .ilike("email", user.email)
        .maybeSingle();

      if (emailError) throw emailError;
      return emailMember;
    },
    enabled: !!user && !!churchId,
  });

  const groupQuery = useQuery({
    queryKey: ["event-request-groups", memberQuery.data?.id, churchId],
    queryFn: async () => {
      const memberId = memberQuery.data?.id;
      if (!memberId) return { ministries: [], communities: [] };

      const [ministriesResult, communitiesResult] = await Promise.all([
        supabase
          .from("member_ministries")
          .select("ministry_id, ministries(id, name)")
          .eq("member_id", memberId),
        supabase
          .from("member_communities")
          .select("community_id, communities(id, name)")
          .eq("member_id", memberId),
      ]);

      return {
        ministries:
          ministriesResult.data
            ?.map((row: any) => row.ministries)
            .filter(Boolean)
            .map((row: any) => ({ id: row.id, name: row.name })) ?? [],
        communities:
          communitiesResult.data
            ?.map((row: any) => row.communities)
            .filter(Boolean)
            .map((row: any) => ({ id: row.id, name: row.name })) ?? [],
      };
    },
    enabled: !!memberQuery.data?.id,
  });

  const requestsQuery = useQuery({
    queryKey: ["event-requests", "member", memberQuery.data?.id],
    queryFn: async () => {
      const memberId = memberQuery.data?.id;
      if (!memberId) return [];
      const { data, error } = await supabase
        .from("event_requests")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!memberQuery.data?.id,
  });

  const requiresMinistry = form.requestType === "ministry_group_event";
  const requiresCommunity = form.requestType === "prayer_formation_event";
  const pageSubtitle = useMemo(
    () =>
      form.requestType === "special_mass_request"
        ? t("event_request.special_mass_notice")
        : t("event_request.review_notice"),
    [form.requestType, t],
  );

  const submitRequest = useMutation({
    mutationFn: async () => {
      if (!churchId || !memberQuery.data) throw new Error(t("event_request.error_no_member"));

      const expectedAttendance = form.expectedAttendance.trim()
        ? Number.parseInt(form.expectedAttendance.trim(), 10)
        : null;

      const { error } = await supabase.from("event_requests").insert({
        church_id: churchId,
        member_id: memberQuery.data.id,
        request_type: form.requestType,
        type: form.requestType,
        title: form.title.trim(),
        description: form.description.trim(),
        preferred_date: normalizeDate(form.preferredDate),
        preferred_start_time: form.preferredStartTime || null,
        preferred_end_time: form.preferredEndTime || null,
        location_preference: form.locationPreference.trim() || null,
        expected_attendance: expectedAttendance,
        ministry_id: form.ministryId || null,
        community_id: form.communityId || null,
        requester_phone: form.requesterPhone.trim() || memberQuery.data.phone || null,
        requester_name: memberQuery.data.full_name || user?.email || t("common.member"),
        additional_notes: form.additionalNotes.trim() || null,
        status: "submitted",
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: t("event_request.success_title"), description: t("event_request.success_description") });
      setForm(emptyForm);
      setErrors({});
      await queryClient.invalidateQueries({ queryKey: ["event-requests"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("event_request.error_title"),
        description: error.message || t("event_request.error_fallback"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.requestType) nextErrors.requestType = t("event_request.validation_event_type");
    if (!form.title.trim()) nextErrors.title = t("event_request.validation_title");
    if (!form.description.trim() || form.description.trim().length < 10) {
      nextErrors.description = t("event_request.validation_description_short");
    }
    if (!form.preferredDate) nextErrors.preferredDate = t("event_request.validation_preferred_date");
    if (form.expectedAttendance && Number.parseInt(form.expectedAttendance, 10) < 0) {
      nextErrors.expectedAttendance = t("event_request.validation_expected_attendance");
    }
    if (requiresMinistry && !form.ministryId) nextErrors.ministryId = t("event_request.validation_ministry");
    if (requiresCommunity && !form.communityId) nextErrors.communityId = t("event_request.validation_community");

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || submitRequest.isPending) return;
    submitRequest.mutate();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif md:text-3xl">{t("event_request.title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("event_request.page_description")}</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {t("event_request.new_request")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("event_request.request_type")}</Label>
                <Select value={form.requestType} onValueChange={(value) => setForm((current) => ({ ...current, requestType: value as RequestType, ministryId: "", communityId: "" }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("event_request.select_type")} />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {translateEventRequestType(t, type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.requestType && <p className="text-xs text-destructive">{errors.requestType}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="requestTitle">{t("event_request.request_title")}</Label>
                <Input id="requestTitle" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestDescription">{t("event_request.description_required")}</Label>
              <Textarea
                id="requestDescription"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={t("event_request.description_placeholder")}
                rows={4}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{t("event_request.preferred_date_required")}</Label>
                <Input type="date" min={new Date().toISOString().split("T")[0]} value={form.preferredDate} onChange={(event) => setForm((current) => ({ ...current, preferredDate: event.target.value }))} />
                {errors.preferredDate && <p className="text-xs text-destructive">{errors.preferredDate}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t("event_request.preferred_start_time")}</Label>
                <Input type="time" value={form.preferredStartTime} onChange={(event) => setForm((current) => ({ ...current, preferredStartTime: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("event_request.preferred_end_time")}</Label>
                <Input type="time" value={form.preferredEndTime} onChange={(event) => setForm((current) => ({ ...current, preferredEndTime: event.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("event_request.location_preference")}</Label>
                <Input value={form.locationPreference} onChange={(event) => setForm((current) => ({ ...current, locationPreference: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("event_request.expected_attendance")}</Label>
                <Input type="number" min={0} value={form.expectedAttendance} onChange={(event) => setForm((current) => ({ ...current, expectedAttendance: event.target.value }))} />
                {errors.expectedAttendance && <p className="text-xs text-destructive">{errors.expectedAttendance}</p>}
              </div>
            </div>

            {requiresMinistry && (
              <div className="space-y-2">
                <Label>{t("event_request.ministry")}</Label>
                <Select value={form.ministryId} onValueChange={(value) => setForm((current) => ({ ...current, ministryId: value }))}>
                  <SelectTrigger><SelectValue placeholder={t("event_request.select_ministry")} /></SelectTrigger>
                  <SelectContent>
                    {(groupQuery.data?.ministries ?? []).map((ministry: any) => (
                      <SelectItem key={ministry.id} value={ministry.id}>{ministry.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.ministryId && <p className="text-xs text-destructive">{errors.ministryId}</p>}
              </div>
            )}

            {requiresCommunity && (
              <div className="space-y-2">
                <Label>{t("event_request.community")}</Label>
                <Select value={form.communityId} onValueChange={(value) => setForm((current) => ({ ...current, communityId: value }))}>
                  <SelectTrigger><SelectValue placeholder={t("event_request.select_community")} /></SelectTrigger>
                  <SelectContent>
                    {(groupQuery.data?.communities ?? []).map((community: any) => (
                      <SelectItem key={community.id} value={community.id}>{community.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.communityId && <p className="text-xs text-destructive">{errors.communityId}</p>}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("event_request.contact_phone")}</Label>
                <Input value={form.requesterPhone} onChange={(event) => setForm((current) => ({ ...current, requesterPhone: event.target.value.replace(/\D/g, "") }))} placeholder={t("event_request.contact_phone_placeholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("event_request.additional_notes")}</Label>
                <Textarea value={form.additionalNotes} onChange={(event) => setForm((current) => ({ ...current, additionalNotes: event.target.value }))} rows={2} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitRequest.isPending || memberQuery.isLoading}>
                {submitRequest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {submitRequest.isPending ? t("event_request.submitting") : t("event_request.submit")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold font-serif">{t("event_request.history_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("event_request.history_description")}</p>
        </div>
        {requestsQuery.isLoading ? (
          <Card className="glass-card"><CardContent className="py-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></CardContent></Card>
        ) : (requestsQuery.data ?? []).length === 0 ? (
          <Card className="glass-card"><CardContent className="py-8 text-center text-muted-foreground">{t("event_request.history_empty")}</CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {(requestsQuery.data ?? []).map((request: any) => (
              <Card key={request.id} className="glass-card">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold">{request.title || translateEventRequestType(t, request.request_type)}</h3>
                      <p className="text-sm text-muted-foreground">{translateEventRequestType(t, request.request_type)}</p>
                    </div>
                    <span className="w-fit rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {translateStatus(t, request.status)}
                    </span>
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                    <span className="flex items-center gap-2"><Calendar className="h-4 w-4" />{request.preferred_date || t("common.not_assigned")}</span>
                    <span className="flex items-center gap-2"><Clock className="h-4 w-4" />{request.preferred_start_time || t("common.not_assigned")}</span>
                    <span>{t("event_request.submitted_on", { date: request.created_at ? new Date(request.created_at).toLocaleDateString() : "" })}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{request.description}</p>
                  {request.admin_notes && (
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                      <p className="font-medium">{t("event_request.admin_response")}</p>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{request.admin_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
