import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

const TANZANIA_PHONE_REGEX = /^255\d{9}$/;

function validateForm(values: {
  event_type: string;
  preferred_date: string;
  contact_phone: string;
  description: string;
}, t: (key: string) => string) {
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
  const [eventType, setEventType] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const { user, churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

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

      const { data: member, error: memberError } = await supabase
        .from("members")
        .select("id, full_name")
        .eq("user_id", user.id)
        .eq("church_id", churchId)
        .maybeSingle();

      if (memberError) {
        throw memberError;
      }

      if (!member) {
        throw new Error("Member profile not found");
      }

      console.log(values);

      const { error } = await supabase.from("event_requests").insert({
        church_id: churchId,
        member_id: member.id,
        request_type: values.event_type,
        preferred_date: values.preferred_date,
        requester_phone: values.contact_phone,
        requester_name: member.full_name,
        description: values.description,
        status: "pending",
      });

      if (error) {
        throw error;
      }
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

    const trimmedValues = {
      event_type: eventType.trim(),
      preferred_date: preferredDate ? new Date(preferredDate).toISOString().split("T")[0] : "",
      contact_phone: contactPhone.trim(),
      description: description.trim(),
    };

    const nextErrors = validateForm(trimmedValues, t);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || submitRequest.isPending) {
      return;
    }

    submitRequest.mutate(trimmedValues);
  };

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold font-serif md:text-3xl">{t("event_request.title")}</h1>
          <p className="text-muted-foreground">{t("event_request.page_description")}</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t("event_request.request_details")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eventType">{t("event_request.event_type_required")}</Label>
                  <Select
                    value={eventType}
                    onValueChange={(value) => {
                      setEventType(value);
                      setErrors((current) => ({ ...current, event_type: undefined }));
                    }}
                  >
                    <SelectTrigger id="eventType">
                      <SelectValue placeholder={t("event_request.select_type")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wedding">{t("event_request.wedding")}</SelectItem>
                      <SelectItem value="baptism">{t("event_request.baptism")}</SelectItem>
                      <SelectItem value="funeral">{t("event_request.funeral")}</SelectItem>
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
                    onChange={(e) => {
                      setPreferredDate(e.target.value);
                      setErrors((current) => ({ ...current, preferred_date: undefined }));
                    }}
                    min={new Date().toISOString().split("T")[0]}
                  />
                  {errors.preferred_date && <p className="text-xs text-destructive">{errors.preferred_date}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">{t("event_request.contact_phone_required")}</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  inputMode="numeric"
                  placeholder={t("event_request.contact_phone_placeholder")}
                  value={contactPhone}
                  onChange={(e) => {
                    setContactPhone(e.target.value.replace(/\D/g, ""));
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
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setErrors((current) => ({ ...current, description: undefined }));
                  }}
                  rows={4}
                />
                {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={submitRequest.isPending}
                  className="min-w-[140px]"
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
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <div className="rounded-lg bg-secondary/50 p-4">
            <h3 className="mb-2 font-semibold">{t("event_request.next_title")}</h3>
            <p className="text-sm text-muted-foreground">{t("event_request.next_description")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
