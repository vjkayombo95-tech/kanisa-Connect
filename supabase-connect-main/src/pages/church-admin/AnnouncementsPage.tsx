import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageToolbar, getWorkspacePageActions, useWorkspacePage } from "@/components/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AnnouncementContent } from "@/components/announcements/AnnouncementContent";
import { AnnouncementRichTextEditor } from "@/components/announcements/AnnouncementRichTextEditor";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Copy,
  Eye,
  Loader2,
  MessageCircle,
  Megaphone,
  Pencil,
  QrCode,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ensureBirthdayAnnouncements } from "@/lib/birthday-announcements";
import {
  announcementHtmlToPlainText,
  isRichTextEmpty,
  normalizeAnnouncementContent,
  sanitizeAnnouncementHtml,
} from "@/lib/announcement-content";
import { assertClientRateLimit } from "@/lib/client-rate-limit";
import { logSupabaseError } from "@/lib/error-logger";
import { buildAnnouncementShareMessage, openWhatsAppShare } from "@/lib/whatsapp-share";

type AnnouncementRecord = {
  id: string;
  church_id: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  status?: AnnouncementStatus | null;
  featured?: boolean | null;
  publish_at?: string | null;
  expires_at?: string | null;
  timezone?: string | null;
  never_expires?: boolean | null;
  audience?: string[] | null;
  target_ministry?: string | null;
  target_community?: string | null;
  show_on_calendar?: boolean | null;
  notification_strategy?: AnnouncementNotificationStrategy | null;
  category?: string | null;
};

type AnnouncementStatus = "draft" | "scheduled" | "active" | "featured" | "expired" | "archived";
type AnnouncementNotificationStrategy = "none" | "immediate" | "on_publish" | "one_day_before_expiry";
type PublishTiming = "now" | "schedule";
type SaveIntent = "draft" | "publish";
type ComposerErrors = Partial<Record<"title" | "content" | "audience" | "publishAt", string>>;
type AnnouncementTargetOption = { id: string; name: string };

const EMPTY_FORM = {
  id: null as string | null,
  title: "",
  content: "",
  isPublished: false,
  publishAt: "",
  expiresAt: "",
  timezone: "Africa/Nairobi",
  neverExpires: true,
  audience: ["everyone"] as string[],
  targetMinistry: "",
  targetCommunity: "",
  showOnCalendar: false,
  notificationStrategy: "none" as AnnouncementNotificationStrategy,
  category: "general",
  featured: false,
};

const audienceOptions = [
  { value: "everyone", label: "Everyone" },
  { value: "members", label: "Members" },
  { value: "visitors", label: "Visitors" },
  { value: "pastor", label: "Priests" },
  { value: "church_admin", label: "Church Admin" },
  { value: "finance", label: "Finance" },
];

const categoryOptions = ["general", "sunday_bulletin", "event", "ministry", "community", "finance", "pastoral"];

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function resolveAnnouncementStatus(announcement: AnnouncementRecord): AnnouncementStatus {
  if (announcement.archived_at) return "archived";
  if (announcement.status) return announcement.status;
  if (announcement.expires_at && !announcement.never_expires && new Date(announcement.expires_at) <= new Date()) return "expired";
  if (!announcement.is_published && announcement.publish_at && new Date(announcement.publish_at) > new Date()) return "scheduled";
  if (announcement.is_published && announcement.featured) return "featured";
  if (announcement.is_published) return "active";
  return "draft";
}

function statusBadgeClass(status: AnnouncementStatus) {
  if (status === "active") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  if (status === "featured") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "scheduled") return "border-blue-400/30 bg-blue-500/10 text-blue-300";
  if (status === "expired") return "border-orange-400/30 bg-orange-500/10 text-orange-300";
  if (status === "archived") return "border-border text-muted-foreground";
  return "border-amber-400/20 bg-amber-500/10 text-amber-200";
}

function formatWindow(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Not set";
}

type AnnouncementMutationResult = {
  success?: boolean;
  error?: string;
  id?: string;
};

function isMissingAnnouncementRpc(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const record = error as { code?: string; message?: string; details?: string; hint?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""} ${record.hint ?? ""}`.toLowerCase();

  return record.code === "PGRST202" || text.includes("schema cache") || text.includes("could not find the function");
}

function SearchableTargetSelect({
  id,
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  options: AnnouncementTargetOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={value ? "truncate" : "truncate text-muted-foreground"}>{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="no target"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check className={`mr-2 h-4 w-4 ${value ? "opacity-0" : "opacity-100"}`} />
                No specific target
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.name} ${option.id}`}
                  onSelect={() => {
                    onChange(option.name);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === option.name ? "opacity-100" : "opacity-0"}`} />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function AnnouncementsPage() {
  const page = useWorkspacePage();
  const [form, setForm] = useState(EMPTY_FORM);
  const [publishTiming, setPublishTiming] = useState<PublishTiming>("now");
  const [composerErrors, setComposerErrors] = useState<ComposerErrors>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatus | "all">("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const composerRef = useRef<HTMLDivElement>(null);

  const { data: church } = useQuery({
    queryKey: ["announcement-share-church", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data, error } = await supabase
        .from("churches")
        .select("name")
        .eq("id", churchId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!churchId,
  });

  const syncAnnouncementsQuery = (updater: (items: AnnouncementRecord[]) => AnnouncementRecord[]) => {
    if (!churchId) return;
    queryClient.setQueryData<AnnouncementRecord[]>(["announcements", churchId], (current = []) => updater(current));
  };

  const invalidateAnnouncementConsumers = () => {
    queryClient.invalidateQueries({ queryKey: ["announcements", churchId] });
    queryClient.invalidateQueries({ queryKey: ["portal-announcements"] });
    queryClient.invalidateQueries({ queryKey: ["portal-announcements-all"] });
    queryClient.invalidateQueries({ queryKey: ["dash-announcements"] });
    queryClient.invalidateQueries({ queryKey: ["portal-home"] });
    queryClient.invalidateQueries({ queryKey: ["parish-calendar-events"] });
  };

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      await ensureBirthdayAnnouncements(churchId);
      await supabase.rpc("update_announcement_lifecycle" as never, { _church_id: churchId } as never);
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AnnouncementRecord[];
    },
    enabled: !!churchId,
  });

  const filteredAnnouncements = useMemo(() => {
    const from = dateFromFilter ? new Date(dateFromFilter) : null;
    const to = dateToFilter ? new Date(dateToFilter) : null;

    return announcements.filter((announcement) => {
      const status = resolveAnnouncementStatus(announcement);
      const announcementDate = new Date(announcement.publish_at ?? announcement.published_at ?? announcement.created_at);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (audienceFilter !== "all" && !(announcement.audience ?? []).includes(audienceFilter)) return false;
      if (categoryFilter !== "all" && (announcement.category ?? "general") !== categoryFilter) return false;
      if (from && announcementDate < from) return false;
      if (to && announcementDate > to) return false;
      return true;
    });
  }, [announcements, audienceFilter, categoryFilter, dateFromFilter, dateToFilter, statusFilter]);

  const activeAnnouncements = useMemo(
    () => filteredAnnouncements.filter((announcement) => !announcement.archived_at),
    [filteredAnnouncements],
  );
  const archivedAnnouncements = useMemo(
    () => filteredAnnouncements.filter((announcement) => !!announcement.archived_at),
    [filteredAnnouncements],
  );

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setPublishTiming("now");
    setComposerErrors({});
  };

  const openCreateDialog = () => {
    resetForm();
    window.requestAnimationFrame(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const toolbarActions = useMemo(
    () => getWorkspacePageActions("announcements", page, { create: openCreateDialog }),
    [page],
  );

  const openEditDialog = (announcement: AnnouncementRecord) => {
    setForm({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      isPublished: announcement.is_published,
      publishAt: toDateTimeLocal(announcement.publish_at ?? announcement.published_at),
      expiresAt: toDateTimeLocal(announcement.expires_at),
      timezone: announcement.timezone ?? "Africa/Nairobi",
      neverExpires: announcement.never_expires ?? !announcement.expires_at,
      audience: announcement.audience?.length ? announcement.audience : ["everyone"],
      targetMinistry: announcement.target_ministry ?? "",
      targetCommunity: announcement.target_community ?? "",
      showOnCalendar: Boolean(announcement.show_on_calendar),
      notificationStrategy: announcement.notification_strategy ?? "none",
      category: announcement.category ?? "general",
      featured: Boolean(announcement.featured),
    });
    setPublishTiming(
      !announcement.is_published && announcement.publish_at && new Date(announcement.publish_at) > new Date()
        ? "schedule"
        : "now",
    );
    setComposerErrors({});
    window.requestAnimationFrame(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const saveAnnouncement = useMutation({
    mutationFn: async ({ intent }: { intent: SaveIntent }) => {
      if (!churchId) throw new Error("No church context");
      assertClientRateLimit(`announcement-post:${churchId}`, 10, 10 * 60 * 1000, "announcement posts");
      const isPublished = intent === "publish" && publishTiming === "now";
      const publishAt = intent === "publish" && publishTiming === "schedule" ? fromDateTimeLocal(form.publishAt) : null;
      const content = sanitizeAnnouncementHtml(normalizeAnnouncementContent(form.content));
      const { data, error } = await supabase.rpc("save_church_announcement" as never, {
        _announcement_id: form.id,
        _church_id: churchId,
        _title: form.title,
        _content: content,
        _is_published: isPublished,
        _publish_at: publishAt,
        _expires_at: form.neverExpires ? null : fromDateTimeLocal(form.expiresAt),
        _timezone: form.timezone,
        _never_expires: form.neverExpires,
        _audience: form.audience,
        _target_ministry: form.targetMinistry || null,
        _target_community: form.targetCommunity || null,
        _show_on_calendar: form.showOnCalendar,
        _notification_strategy: form.notificationStrategy,
        _category: form.category,
        _featured: form.featured,
      } as never);

      if (error) {
        if (!isMissingAnnouncementRpc(error)) throw error;

        console.warn("Announcement save RPC unavailable; using direct Supabase fallback:", error);
        const publishedAt = isPublished ? new Date().toISOString() : null;
        const lifecyclePayload = {
          publish_at: publishAt,
          expires_at: form.neverExpires ? null : fromDateTimeLocal(form.expiresAt),
          timezone: form.timezone,
          never_expires: form.neverExpires,
          audience: form.audience,
          target_ministry: form.targetMinistry || null,
          target_community: form.targetCommunity || null,
          show_on_calendar: form.showOnCalendar,
          notification_strategy: form.notificationStrategy,
          category: form.category,
          featured: form.featured,
        };

        if (form.id) {
          const { error: updateError } = await supabase
            .from("announcements")
            .update({
              title: form.title.trim(),
              content,
              is_published: isPublished,
              published_at: publishedAt,
              archived_at: null,
              updated_at: new Date().toISOString(),
              ...lifecyclePayload,
            })
            .eq("id", form.id)
            .eq("church_id", churchId);

          if (updateError) throw updateError;
          return;
        }

        const { error: insertError } = await supabase
          .from("announcements")
          .insert({
            church_id: churchId,
            title: form.title.trim(),
            content,
            is_published: isPublished,
            published_at: publishedAt,
            created_by: user?.id ?? null,
            ...lifecyclePayload,
          });

        if (insertError) throw insertError;
        return;
      }

      const result = data as AnnouncementMutationResult | null;
      if (!result?.success) {
        throw new Error(result?.error || "Announcement save failed.");
      }
    },
    onSuccess: (_, { intent }) => {
      invalidateAnnouncementConsumers();
      toast({
        title:
          intent === "draft"
            ? "Draft saved"
            : form.id
              ? "Announcement updated"
              : publishTiming === "schedule"
                ? "Announcement scheduled"
                : "Announcement published",
      });
      resetForm();
    },
    onError: (err: Error) => {
      logSupabaseError(err, {
        page: "Announcements",
        component: "AnnouncementsPage",
        function: "saveAnnouncement",
        church_id: churchId,
        operation: "rpc",
        rpc: "save_church_announcement",
        metadata: { announcement_id: form.id, publish_timing: publishTiming },
      });
      toast({ title: "Unable to save announcement", description: "Please review the form and try again.", variant: "destructive" });
    },
  });

  const {
    data: targetOptions = { ministries: [] as AnnouncementTargetOption[], communities: [] as AnnouncementTargetOption[] },
    isLoading: targetOptionsLoading,
    isError: targetOptionsError,
  } = useQuery({
    queryKey: ["announcement-target-options", churchId],
    queryFn: async () => {
      if (!churchId) return { ministries: [], communities: [] };
      const [ministriesResult, communitiesResult] = await Promise.all([
        supabase.from("ministries").select("id,name").eq("church_id", churchId).order("name", { ascending: true }),
        supabase.from("communities").select("id,name").eq("church_id", churchId).order("name", { ascending: true }),
      ]);

      if (ministriesResult.error) throw ministriesResult.error;
      if (communitiesResult.error) throw communitiesResult.error;

      const normalize = (rows: Array<{ id: string; name: string | null }>) =>
        rows.filter((row): row is AnnouncementTargetOption => Boolean(row.id && row.name?.trim())).map((row) => ({
          id: row.id,
          name: row.name.trim(),
        }));

      return {
        ministries: normalize(ministriesResult.data ?? []),
        communities: normalize(communitiesResult.data ?? []),
      };
    },
    enabled: !!churchId,
  });

  const submitAnnouncement = (intent: SaveIntent) => {
    const errors: ComposerErrors = {};
    if (!form.title.trim()) errors.title = "Title is required.";
    if (isRichTextEmpty(form.content)) errors.content = "Message is required.";
    if (form.audience.length === 0) errors.audience = "Select at least one audience.";
    if (intent === "publish" && publishTiming === "schedule") {
      const scheduledAt = form.publishAt ? new Date(form.publishAt) : null;
      if (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        errors.publishAt = "Choose a future date and time.";
      }
    }

    setComposerErrors(errors);
    if (Object.keys(errors).length > 0 || saveAnnouncement.isPending) return;
    saveAnnouncement.mutate({ intent });
  };

  const archiveAnnouncement = useMutation({
    mutationFn: async (announcement: AnnouncementRecord) => {
      const { data, error } = await supabase.rpc("set_church_announcement_archived" as never, {
        _announcement_id: announcement.id,
        _archived: !announcement.archived_at,
      } as never);

      if (error) {
        if (!isMissingAnnouncementRpc(error)) throw error;

        console.warn("Announcement archive RPC unavailable; using direct Supabase fallback:", error);
        const archiving = !announcement.archived_at;
        const { error: updateError } = await supabase
          .from("announcements")
          .update({
            archived_at: archiving ? new Date().toISOString() : null,
            is_published: archiving ? false : announcement.is_published,
            published_at: archiving ? null : announcement.published_at,
            updated_at: new Date().toISOString(),
          })
          .eq("id", announcement.id)
          .eq("church_id", churchId ?? "");

        if (updateError) throw updateError;
        return;
      }

      const result = data as AnnouncementMutationResult | null;
      if (!result?.success) {
        throw new Error(result?.error || "Announcement archive update failed.");
      }
    },
    onSuccess: (_, announcement) => {
      syncAnnouncementsQuery((items) =>
        items.map((item) =>
          item.id === announcement.id
            ? {
                ...item,
                archived_at: announcement.archived_at ? null : new Date().toISOString(),
                is_published: announcement.archived_at ? announcement.is_published : false,
                published_at: announcement.archived_at ? announcement.published_at : null,
                updated_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      invalidateAnnouncementConsumers();
      toast({ title: announcement.archived_at ? "Announcement restored" : "Announcement archived" });
    },
    onError: (err: Error) => {
      logSupabaseError(err, {
        page: "Announcements",
        component: "AnnouncementsPage",
        function: "archiveAnnouncement",
        church_id: churchId,
        operation: "rpc",
        rpc: "set_church_announcement_archived",
      });
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async (announcement: AnnouncementRecord) => {
      const { data, error } = await supabase.rpc("delete_church_announcement" as never, {
        _announcement_id: announcement.id,
      } as never);

      if (error) {
        if (!isMissingAnnouncementRpc(error)) throw error;

        console.warn("Announcement delete RPC unavailable; using direct Supabase fallback:", error);
        const { error: deleteError } = await supabase
          .from("announcements")
          .delete()
          .eq("id", announcement.id)
          .eq("church_id", churchId ?? "");

        if (deleteError) throw deleteError;
        return;
      }

      const result = data as AnnouncementMutationResult | null;
      if (!result?.success) {
        throw new Error(result?.error || "Announcement delete failed.");
      }
    },
    onSuccess: (_, announcement) => {
      syncAnnouncementsQuery((items) => items.filter((item) => item.id !== announcement.id));
      invalidateAnnouncementConsumers();
      toast({ title: "Announcement deleted" });
    },
    onError: (err: Error) => {
      logSupabaseError(err, {
        page: "Announcements",
        component: "AnnouncementsPage",
        function: "deleteAnnouncement",
        church_id: churchId,
        operation: "rpc",
        rpc: "delete_church_announcement",
      });
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const publishNowAnnouncement = useMutation({
    mutationFn: async (announcement: AnnouncementRecord) => {
      if (!churchId) throw new Error("No church context");
      const now = new Date().toISOString();
      const { data, error } = await supabase.rpc("save_church_announcement" as never, {
        _announcement_id: announcement.id,
        _church_id: churchId,
        _title: announcement.title,
        _content: announcement.content,
        _is_published: true,
        _publish_at: now,
        _expires_at: announcement.never_expires ? null : announcement.expires_at,
        _timezone: announcement.timezone ?? "Africa/Nairobi",
        _never_expires: announcement.never_expires ?? !announcement.expires_at,
        _audience: announcement.audience?.length ? announcement.audience : ["everyone"],
        _target_ministry: announcement.target_ministry ?? null,
        _target_community: announcement.target_community ?? null,
        _show_on_calendar: Boolean(announcement.show_on_calendar),
        _notification_strategy: announcement.notification_strategy ?? "on_publish",
        _category: announcement.category ?? "general",
        _featured: Boolean(announcement.featured),
      } as never);

      if (error) {
        if (!isMissingAnnouncementRpc(error)) throw error;

        const { error: updateError } = await supabase
          .from("announcements")
          .update({
            is_published: true,
            published_at: now,
            publish_at: now,
            archived_at: null,
            updated_at: now,
          } as never)
          .eq("id", announcement.id)
          .eq("church_id", churchId);

        if (updateError) throw updateError;
        return;
      }

      const result = data as AnnouncementMutationResult | null;
      if (!result?.success) {
        throw new Error(result?.error || "Announcement publish failed.");
      }
    },
    onSuccess: () => {
      invalidateAnnouncementConsumers();
      toast({ title: "Announcement published", description: "The announcement is active for its selected audience." });
    },
    onError: (err: Error) => {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    },
  });

  const duplicateAnnouncement = (announcement: AnnouncementRecord) => {
    setForm({
      id: null,
      title: `${announcement.title} copy`,
      content: announcement.content,
      isPublished: false,
      publishAt: "",
      expiresAt: toDateTimeLocal(announcement.expires_at),
      timezone: announcement.timezone ?? "Africa/Nairobi",
      neverExpires: announcement.never_expires ?? !announcement.expires_at,
      audience: announcement.audience?.length ? announcement.audience : ["everyone"],
      targetMinistry: announcement.target_ministry ?? "",
      targetCommunity: announcement.target_community ?? "",
      showOnCalendar: Boolean(announcement.show_on_calendar),
      notificationStrategy: announcement.notification_strategy ?? "none",
      category: announcement.category ?? "general",
      featured: Boolean(announcement.featured),
    });
    setPublishTiming("now");
    setComposerErrors({});
    window.requestAnimationFrame(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const publishNow = (announcement: AnnouncementRecord) => {
    publishNowAnnouncement.mutate(announcement);
  };

  const AnnouncementCard = ({ announcement }: { announcement: AnnouncementRecord }) => {
    const status = resolveAnnouncementStatus(announcement);
    const audience = announcement.audience?.length ? announcement.audience : ["everyone"];

    return (
      <Card key={announcement.id} className="glass-card">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{announcement.title}</h3>
                <Badge variant="outline" className={statusBadgeClass(status)}>
                  {status.replace("_", " ")}
                </Badge>
                {announcement.featured && (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    <Star className="mr-1 h-3 w-3" />
                    Featured
                  </Badge>
                )}
                {announcement.show_on_calendar && (
                  <Badge variant="outline" className="border-blue-400/30 bg-blue-500/10 text-blue-200">
                    <CalendarDays className="mr-1 h-3 w-3" />
                    Calendar
                  </Badge>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {announcementHtmlToPlainText(announcement.content)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground/75">
                <span>Publish: {formatWindow(announcement.publish_at ?? announcement.published_at)}</span>
                <span>Expires: {announcement.never_expires ? "Never" : formatWindow(announcement.expires_at)}</span>
                <span>Audience: {audience.join(", ")}</span>
                <span>Category: {announcement.category ?? "general"}</span>
                <span>Notify: {announcement.notification_strategy ?? "none"}</span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  openWhatsAppShare(
                    buildAnnouncementShareMessage({
                      churchName: church?.name,
                      title: announcement.title,
                      body: announcement.content,
                    }),
                  )
                }
              >
                <MessageCircle className="mr-2 h-3.5 w-3.5" />
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast({
                    title: announcement.title,
                    description: announcementHtmlToPlainText(announcement.content).slice(0, 180),
                  })
                }
              >
                <Eye className="mr-2 h-3.5 w-3.5" />
                Preview
              </Button>
              <Button variant="outline" size="sm" onClick={() => duplicateAnnouncement(announcement)}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Duplicate
              </Button>
              {status !== "active" && status !== "featured" && !announcement.archived_at && (
                <Button variant="outline" size="sm" onClick={() => publishNow(announcement)} disabled={publishNowAnnouncement.isPending}>
                  <Send className="mr-2 h-3.5 w-3.5" />
                  Publish now
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => openEditDialog(announcement)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => archiveAnnouncement.mutate(announcement)}
                disabled={archiveAnnouncement.isPending}
              >
                <Archive className="mr-2 h-3.5 w-3.5" />
                {announcement.archived_at ? "Restore" : "Archive"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast({ title: "QR placeholder", description: "Public QR sharing will be enabled with the external announcement page." })}
              >
                <QrCode className="mr-2 h-3.5 w-3.5" />
                QR
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteAnnouncement.mutate(announcement)}
                disabled={deleteAnnouncement.isPending}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageToolbar
        title="Announcements"
        description="Read and manage parish announcements using the active workspace permissions."
        actions={toolbarActions}
      />
      <Card ref={composerRef} className="glass-card scroll-mt-24">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="font-serif text-2xl">
                {form.id ? "Edit Announcement" : "New Announcement"}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Write a clear update, choose who should see it, then save a draft or publish it.
              </p>
            </div>
            {form.id && (
              <Button variant="ghost" type="button" onClick={resetForm}>
                Cancel editing
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              submitAnnouncement("publish");
            }}
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="announcement-title">Title *</Label>
                  <Input
                    id="announcement-title"
                    placeholder="What is this announcement about?"
                    value={form.title}
                    aria-invalid={Boolean(composerErrors.title)}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, title: event.target.value }));
                      setComposerErrors((current) => ({ ...current, title: undefined }));
                    }}
                  />
                  {composerErrors.title && <p className="text-sm text-destructive">{composerErrors.title}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="announcement-message">Message *</Label>
                  <AnnouncementRichTextEditor
                    placeholder="Write the announcement members should receive..."
                    value={form.content}
                    error={composerErrors.content}
                    aria-describedby={composerErrors.content ? "announcement-message-error" : undefined}
                    onChange={(content) => {
                      setForm((current) => ({ ...current, content }));
                      setComposerErrors((current) => ({ ...current, content: undefined }));
                    }}
                  />
                  {composerErrors.content && <p id="announcement-message-error" role="alert" className="text-sm text-destructive">{composerErrors.content}</p>}
                </div>
              </div>

              <div className="space-y-5 rounded-xl border border-border/60 bg-muted/15 p-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(category) => setForm((current) => ({ ...current, category }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Publish timing</Label>
                  <Select
                    value={publishTiming}
                    onValueChange={(value) => {
                      setPublishTiming(value as PublishTiming);
                      setComposerErrors((current) => ({ ...current, publishAt: undefined }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="now">Publish now</SelectItem>
                      <SelectItem value="schedule">Schedule for later</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {publishTiming === "schedule" && (
                  <div className="space-y-2">
                    <Label htmlFor="publish-at">Publish date and time *</Label>
                    <Input
                      id="publish-at"
                      type="datetime-local"
                      value={form.publishAt}
                      aria-invalid={Boolean(composerErrors.publishAt)}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, publishAt: event.target.value }));
                        setComposerErrors((current) => ({ ...current, publishAt: undefined }));
                      }}
                    />
                    {composerErrors.publishAt && <p className="text-sm text-destructive">{composerErrors.publishAt}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={form.timezone}
                    onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                    placeholder="Africa/Nairobi"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Audience *</Label>
                <p className="text-sm text-muted-foreground">Choose the people who should see this announcement.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {audienceOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.audience.includes(option.value)}
                      onCheckedChange={(checked) => {
                        setForm((current) => {
                          if (option.value === "everyone" && checked) return { ...current, audience: ["everyone"] };
                          const withoutEveryone = current.audience.filter((item) => item !== "everyone");
                          const next = checked
                            ? Array.from(new Set([...withoutEveryone, option.value]))
                            : withoutEveryone.filter((item) => item !== option.value);
                          return { ...current, audience: next.length ? next : ["everyone"] };
                        });
                        setComposerErrors((current) => ({ ...current, audience: undefined }));
                      }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {composerErrors.audience && <p className="text-sm text-destructive">{composerErrors.audience}</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="target-ministry">Target ministry</Label>
                <SearchableTargetSelect
                  id="target-ministry"
                  value={form.targetMinistry}
                  options={targetOptions.ministries}
                  placeholder={targetOptionsLoading ? "Loading ministries..." : "Search ministries"}
                  searchPlaceholder="Type a ministry name..."
                  emptyMessage={targetOptionsError ? "Unable to load ministries." : "No matching ministry found."}
                  disabled={targetOptionsLoading}
                  onChange={(targetMinistry) => setForm((current) => ({ ...current, targetMinistry }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-community">Target community</Label>
                <SearchableTargetSelect
                  id="target-community"
                  value={form.targetCommunity}
                  options={targetOptions.communities}
                  placeholder={targetOptionsLoading ? "Loading communities..." : "Search communities"}
                  searchPlaceholder="Type a community name..."
                  emptyMessage={targetOptionsError ? "Unable to load communities." : "No matching community found."}
                  disabled={targetOptionsLoading}
                  onChange={(targetCommunity) => setForm((current) => ({ ...current, targetCommunity }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>In-app notification</Label>
                <Select
                  value={form.notificationStrategy}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, notificationStrategy: value as AnnouncementNotificationStrategy }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Do not notify</SelectItem>
                    <SelectItem value="immediate">Notify immediately</SelectItem>
                    <SelectItem value="on_publish">Notify when published</SelectItem>
                    <SelectItem value="one_day_before_expiry">One day before expiry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expires-at">Expiry date and time</Label>
                <Input
                  id="expires-at"
                  type="datetime-local"
                  value={form.expiresAt}
                  disabled={form.neverExpires}
                  onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <div className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5">
                  <Switch
                    id="never-expires"
                    checked={form.neverExpires}
                    onCheckedChange={(neverExpires) => setForm((current) => ({ ...current, neverExpires }))}
                  />
                  <Label htmlFor="never-expires">Never expires</Label>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                <Checkbox
                  checked={form.featured}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, featured: Boolean(checked) }))}
                />
                Feature this announcement
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                <Checkbox
                  checked={form.showOnCalendar}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, showOnCalendar: Boolean(checked) }))}
                />
                Show on parish calendar
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)} disabled={!form.title.trim() && isRichTextEmpty(form.content)}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button type="button" variant="secondary" onClick={() => submitAnnouncement("draft")} disabled={saveAnnouncement.isPending}>
                {saveAnnouncement.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Draft
              </Button>
              <Button type="submit" disabled={saveAnnouncement.isPending}>
                {saveAnnouncement.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {form.id ? "Save Changes" : publishTiming === "schedule" ? "Schedule Announcement" : "Publish Announcement"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Announcement preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 rounded-xl border border-border/60 bg-muted/15 p-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{form.category.replace("_", " ")}</Badge>
              <Badge variant="outline">{form.audience.includes("everyone") ? "Everyone" : form.audience.join(", ")}</Badge>
            </div>
            <div>
              <h2 className="font-serif text-2xl">{form.title.trim() || "Untitled announcement"}</h2>
              {isRichTextEmpty(form.content) ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">No message has been written yet.</p>
              ) : (
                <AnnouncementContent content={form.content} className="mt-3" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {publishTiming === "schedule" && form.publishAt
                ? `Scheduled for ${formatWindow(fromDateTimeLocal(form.publishAt))} (${form.timezone})`
                : "Publishes immediately when submitted."}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="glass-card">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AnnouncementStatus | "all")}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(["draft", "scheduled", "active", "featured", "expired", "archived"] as AnnouncementStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={audienceFilter} onValueChange={setAudienceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All audiences" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All audiences</SelectItem>
                {audienceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-from">From</Label>
            <Input id="date-from" type="date" value={dateFromFilter} onChange={(event) => setDateFromFilter(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-to">To</Label>
            <Input id="date-to" type="date" value={dateToFilter} onChange={(event) => setDateToFilter(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : announcements.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Megaphone className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <p>No announcements yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {activeAnnouncements.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No announcements match the current lifecycle filters.
                </CardContent>
              </Card>
            ) : (
              activeAnnouncements.map((announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} />
              ))
            )}
          </div>

          {archivedAnnouncements.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="font-semibold">Archived</h2>
                <p className="text-sm text-muted-foreground">Stored announcements that are hidden from members.</p>
              </div>
              {archivedAnnouncements.map((announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
