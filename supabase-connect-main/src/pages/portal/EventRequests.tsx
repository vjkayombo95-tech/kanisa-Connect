import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Loader2, Send } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

type FormErrors = {
  event_type?: string;
  preferred_date?: string;
  contact_phone?: string;
  description?: string;
};

type ServiceKey = "wedding" | "baptism" | "confirmation" | "first_communion" | "funeral" | "requested_event" | "other";

type MemberEventRequest = {
  id: string;
  type: string | null;
  request_type: string | null;
  status: string | null;
  preferred_date: string | null;
  created_at: string | null;
};

const TANZANIA_PHONE_REGEX = /^255\d{9}$/;
const SERVICE_KEYS: ServiceKey[] = ["wedding", "baptism", "confirmation", "first_communion", "funeral", "requested_event", "other"];

const SERVICE_MAPPING: Record<ServiceKey, { requestType: string; type: string }> = {
  wedding: { requestType: "parish_event", type: "wedding" },
  baptism: { requestType: "parish_event", type: "baptism" },
  confirmation: { requestType: "parish_event", type: "confirmation" },
  first_communion: { requestType: "parish_event", type: "first_communion" },
  funeral: { requestType: "parish_event", type: "funeral" },
  requested_event: { requestType: "parish_event", type: "requested_event" },
  other: { requestType: "other", type: "other_office_service" },
};

const SERVICE_LABEL_KEYS: Record<string, string> = {
  wedding: "event_request.wedding",
  baptism: "event_request.baptism",
  confirmation: "event_request.confirmation",
  first_communion: "event_request.first_communion",
  funeral: "event_request.funeral",
  requested_event: "event_request.requested_event",
  other_office_service: "event_request.other",
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: "event_request.status_draft",
  submitted: "event_request.status_submitted",
  under_review: "event_request.status_under_review",
  changes_requested: "event_request.status_changes_requested",
  approved: "event_request.status_approved",
  rejected: "event_request.status_rejected",
  converted: "event_request.status_converted",
  scheduled: "event_request.status_scheduled",
  cancelled: "event_request.status_cancelled",
};

function getServiceFromSearch(search: string): ServiceKey | "" {
  const value = new URLSearchParams(search).get("service");
  return SERVICE_KEYS.includes(value as ServiceKey) ? (value as ServiceKey) : "";
}

function validateForm(
  values: {
    event_type: string;
    preferred_date: string;
    contact_phone: string;
    description: string;
  },
  t: (key: string) => string,
) {
  const errors: FormErrors = {};

  if (!values.event_type) {
    errors.event_type = t("event_request.validation_event_type");
  }

  if (!values.preferred_date) {
    errors.preferred_date = t("event_request.validation_preferred_date");
  }

  if (!values.contact_phone) {
    errors.contact_phone = t("event_request.validation_contact_phone");
  } else if (!TANZANIA_PHONE_REGEX.test(values.contact_phone)) {
    errors.contact_phone = t("event_request.validation_contact_phone_format");
  }

  if (!values.description) {
    errors.description = t("event_request.validation_description");
  } else if (values.description.length < 10) {
    errors.description = t("event_request.validation_description_short");
  }

  return errors;
}

export default function EventRequests() {
  const location = useLocation();
  const [eventType, setEventType] = useState<ServiceKey | "">(() => getServiceFromSearch(location.search));
  const [preferredDate, setPreferredDate] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const { user, churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const member = useQuery({
    queryKey: ["event-request-member", churchId, user?.id],
    queryFn: async () => {
      if (!user || !churchId) return null;

      const { data, error } = await supabase
        .from("members")
        .select("id, full_name")
        .eq("user_id", user.id)
        .eq("church_id", churchId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!churchId,
  });

  const myRequests = useQuery({
    queryKey: ["event-requests", churchId, member.data?.id],
    queryFn: async () => {
      if (!churchId || !member.data?.id) return [];

      const { data, error } = await supabase
        .from("event_requests")
        .select("id, type, request_type, status, preferred_date, created_at")
        .eq("church_id", churchId)
        .eq("member_id", member.data.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as MemberEventRequest[];
    },
    enabled: !!churchId && !!member.data?.id,
  });

  const submitRequest = useMutation({
    mutationFn: async (values: {
      event_type: string;
      preferred_date: string;
      contact_phone: string;
      description: string;
    }) => {
      if (!user || !churchId) {
        throw new Error("Authentication required");
      }

      if (!member.data) {
        throw new Error("Member profile not found");
      }

      const service = SERVICE_MAPPING[values.event_type as ServiceKey];
      if (!service) {
        throw new Error("Invalid service type");
      }

      const { error } = await supabase.from("event_requests").insert({
        church_id: churchId,
        member_id: member.data.id,
        request_type: service.requestType,
        type: service.type,
        preferred_date: values.preferred_date,
        requester_phone: values.contact_phone,
        requester_name: member.data.full_name,
        description: values.description,
        status: "submitted",
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      toast({
        title: t("event_request.success_title"),
        description: t("event_request.success_description"),
      });

      setEventType("");
      setPreferredDate("");
      setContactPhone("");
      setDescription("");
      setErrors({});

      await queryClient.invalidateQueries({ queryKey: ["event-requests", churchId, member.data?.id] });
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

    const trimmedValues = {
      event_type: eventType,
      preferred_date: preferredDate,
      contact_phone: contactPhone.trim(),
      description: description.trim(),
    };

    const nextErrors = validateForm(trimmedValues, t);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || submitRequest.isPending) return;

    submitRequest.mutate(trimmedValues);
  };

  const serviceLabel = (request: MemberEventRequest) => {
    const key = request.type ? SERVICE_LABEL_KEYS[request.type] : undefined;
    return key ? t(key) : t("event_request.other");
  };

  const statusLabel = (status: string | null) => {
    if (!status) return t("event_request.status_submitted");
    const key = STATUS_LABEL_KEYS[status];
    return key ? t(key) : status;
  };

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-serif md:text-3xl">{t("event_request.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("event_request.page_description")}</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t("event_request.request_details")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="eventType">{t("event_request.event_type_required")}</Label>
                <Select
                  value={eventType}
                  onValueChange={(value) => {
                    setEventType(SERVICE_KEYS.includes(value as ServiceKey) ? (value as ServiceKey) : "");
                    setErrors((current) => ({ ...current, event_type: undefined }));
                  }}
                >
                  <SelectTrigger id="eventType">
                    <SelectValue placeholder={t("event_request.select_type")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wedding">{t("event_request.wedding")}</SelectItem>
                    <SelectItem value="baptism">{t("event_request.baptism")}</SelectItem>
                    <SelectItem value="confirmation">{t("event_request.confirmation")}</SelectItem>
                    <SelectItem value="first_communion">{t("event_request.first_communion")}</SelectItem>
                    <SelectItem value="funeral">{t("event_request.funeral")}</SelectItem>
                    <SelectItem value="requested_event">{t("event_request.requested_event")}</SelectItem>
                    <SelectItem value="other">{t("event_request.other")}</SelectItem>
                  </SelectContent>
                </Select>
                {errors.event_type && <p className="text-xs text-destructive">{errors.event_type}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredDate">{t("event_request.preferred_date_required")}</Label>
                <Input
                  id="preferredDate"
                  type="date"
                  value={preferredDate}
                  onChange={(event) => {
                    setPreferredDate(event.target.value);
                    setErrors((current) => ({ ...current, preferred_date: undefined }));
                  }}
                />
                {errors.preferred_date && <p className="text-xs text-destructive">{errors.preferred_date}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">{t("event_request.contact_phone_required")}</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  inputMode="numeric"
                  placeholder={t("event_request.contact_phone_placeholder")}
                  value={contactPhone}
                  onChange={(event) => {
                    setContactPhone(event.target.value.replace(/\D/g, ""));
                    setErrors((current) => ({ ...current, contact_phone: undefined }));
                  }}
                />
                {errors.contact_phone && <p className="text-xs text-destructive">{errors.contact_phone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("event_request.description_required")}</Label>
                <Textarea
                  id="description"
                  placeholder={t("event_request.description_placeholder")}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setErrors((current) => ({ ...current, description: undefined }));
                  }}
                  rows={4}
                />
                {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
              </div>

              <Button
                type="submit"
                disabled={submitRequest.isPending || member.isLoading || !member.data}
                className="w-full sm:w-auto"
              >
                {submitRequest.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("event_request.submitting")}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {t("event_request.submit")}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="rounded-lg bg-secondary/50 p-4">
          <h3 className="mb-1 font-semibold">{t("event_request.next_title")}</h3>
          <p className="text-sm text-muted-foreground">{t("event_request.next_description")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("event_request.my_requests")}</CardTitle>
          </CardHeader>
          <CardContent>
            {member.isLoading || myRequests.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("event_request.loading_requests")}
              </div>
            ) : myRequests.isError ? (
              <p className="text-sm text-destructive">{t("event_request.requests_error")}</p>
            ) : myRequests.data?.length ? (
              <div className="space-y-3">
                {myRequests.data.map((request) => (
                  <div key={request.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{serviceLabel(request)}</p>
                        {request.preferred_date && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t("event_request.preferred_date")}: {request.preferred_date}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                        {statusLabel(request.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("event_request.no_requests")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
