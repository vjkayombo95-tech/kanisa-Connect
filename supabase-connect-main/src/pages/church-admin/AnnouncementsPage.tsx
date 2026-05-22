import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Archive,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
};

type MessageTemplateRecord = Tables<"message_templates">;
type MessageInsert = TablesInsert<"messages">;

type AIComposerForm = {
  title: string;
  content: string;
};

const EMPTY_FORM = {
  id: null as string | null,
  title: "",
  content: "",
  isPublished: false,
};

const EMPTY_AI_FORM: AIComposerForm = {
  title: "",
  content: "",
};

const suggestionOptions = [
  { label: "Announce Sunday Service", type: "service", fallbackTitle: { sw: "Tangazo la Ibada ya Jumapili", en: "Sunday Service Announcement" } },
  { label: "Youth Meeting", type: "youth", fallbackTitle: { sw: "Tangazo la Mkutano wa Vijana", en: "Youth Meeting Announcement" } },
  { label: "Prayer Meeting", type: "prayer", fallbackTitle: { sw: "Tangazo la Mkutano wa Maombi", en: "Prayer Meeting Announcement" } },
  { label: "Special Event", type: "event", fallbackTitle: { sw: "Tangazo la Tukio Maalum", en: "Special Event Announcement" } },
] as const;

type SuggestionType = (typeof suggestionOptions)[number]["type"];
type LanguageType = "sw" | "en";

type AnnouncementMutationResult = {
  success?: boolean;
  error?: string;
  id?: string;
};

const AI_GENERATION_DELAY_MS = 1100;
const AI_CONNECTION_DELAY_MS = 350;

const mockTemplates: Record<SuggestionType, Record<LanguageType, Array<Pick<MessageTemplateRecord, "title" | "content">>>> = {
  service: {
    sw: [
      { title: "Tangazo la Ibada ya Jumapili", content: "Karibuni kwenye ibada yetu ya Jumapili hii kuanzia saa 2:00 asubuhi. Tutakuwa na muda wa maombi, sifa na neno la Mungu. Tafadhali fika mapema na umkaribishe jirani yako." },
      { title: "Ibada ya Jumapili Wiki Hii", content: "Kanisa linawakaribisha waumini wote kwenye ibada ya Jumapili hii. Njoo tushirikiane katika kuabudu, kusikiliza neno la Mungu na kuombeana kama familia ya imani." },
      { title: "Tusikose Ibada ya Jumapili", content: "Tunawakumbusha waumini wote kuhusu ibada ya Jumapili ijayo. Huu ni wakati wa kujengwa kiroho, kuungana na wengine na kumtukuza Mungu pamoja." },
    ],
    en: [
      { title: "Sunday Service Announcement", content: "Join us this Sunday for a powerful worship service starting at 8:00 AM. Expect prayer, praise, and a timely word for the church family. Come early and invite someone." },
      { title: "This Week's Sunday Service", content: "You are warmly invited to our Sunday service this week. Let us gather in faith, worship together, and receive encouragement from the Word of God." },
      { title: "Do Not Miss Sunday Service", content: "We are reminding the church family about the upcoming Sunday service. It will be a meaningful time of worship, fellowship, and spiritual renewal." },
    ],
  },
  youth: {
    sw: [
      { title: "Tangazo la Mkutano wa Vijana", content: "Vijana wote mnakaribishwa kwenye mkutano wa vijana Ijumaa hii jioni. Tutakuwa na neno, maombi, mjadala na muda wa kujengana katika imani." },
      { title: "Kikao cha Vijana Wiki Hii", content: "Tunawakumbusha vijana wote kuhusu mkutano wetu wa wiki hii. Njoo tushirikiane, tujifunze pamoja, na kuimarishana kiroho." },
      { title: "Karibu Mkutano wa Vijana", content: "Mkutano wa vijana unafanyika wiki hii na kila kijana anakaribishwa. Leta rafiki yako na tuwe na muda mzuri wa ibada, neno na ushirika." },
    ],
    en: [
      { title: "Youth Meeting Announcement", content: "All young people are invited to this week's youth meeting. We will have worship, a short teaching, prayer, and time to connect as a growing faith community." },
      { title: "Youth Fellowship This Week", content: "Please join us for our youth fellowship this week. It will be a refreshing space for encouragement, discipleship, and real connection." },
      { title: "Join the Youth Gathering", content: "The youth gathering is happening this week and everyone is welcome. Bring a friend and come ready for worship, learning, and fellowship." },
    ],
  },
  prayer: {
    sw: [
      { title: "Tangazo la Mkutano wa Maombi", content: "Karibu kwenye mkutano wa maombi utakaofanyika Jumatano jioni. Tutatafuta uso wa Mungu pamoja na kuombea familia, kanisa na taifa letu." },
      { title: "Muda wa Maombi ya Kanisa", content: "Tunawakumbusha waumini wote kuhusu mkutano wa maombi wa wiki hii. Njoo tushirikiane katika maombi na kuimarisha maisha yetu ya kiroho." },
      { title: "Tusimame Pamoja Katika Maombi", content: "Kanisa linakaribisha waumini wote kwenye mkutano wa maombi. Huu ni wakati wa kuleta mahitaji yetu mbele za Mungu na kuombeana kwa upendo." },
    ],
    en: [
      { title: "Prayer Meeting Announcement", content: "You are invited to our church prayer meeting this week. Let us seek God together and lift up our families, church, and community in prayer." },
      { title: "Church Prayer Gathering", content: "Please join us for a special time of prayer this week. We will gather to intercede, encourage one another, and grow deeper in faith." },
      { title: "Stand With Us in Prayer", content: "Our prayer meeting is coming up this week. Come ready to pray, believe, and stand together for the needs of the church and community." },
    ],
  },
  event: {
    sw: [
      { title: "Tangazo la Tukio Maalum", content: "Tunayo furaha kuwatangazia tukio maalum litakalofanyika hivi karibuni kanisani. Tafadhali jiandae kushiriki nasi katika siku hii ya pekee na uendelee kufuatilia taarifa zaidi." },
      { title: "Karibu Tukio Maalum la Kanisa", content: "Kanisa linakualika kwenye tukio maalum linalokuja. Hii itakuwa nafasi ya baraka, ushirika na shangwe kwa familia yote ya kanisa." },
      { title: "Usikose Tukio Hili Maalum", content: "Tunawaalika wote kushiriki kwenye tukio maalum la kanisa. Endelea kufuatilia maelezo zaidi na jiandae kuwa sehemu ya siku hii ya kipekee." },
    ],
    en: [
      { title: "Special Event Announcement", content: "We are excited to announce a special church event coming soon. Please prepare to join us for a memorable and uplifting time together." },
      { title: "You Are Invited to a Special Event", content: "Our church family is invited to an upcoming special event. It will be a meaningful opportunity for fellowship, celebration, and encouragement." },
      { title: "Do Not Miss This Special Event", content: "A special event is on the way, and we would love to see you there. Watch for more details and get ready to be part of something memorable." },
    ],
  },
};

function shuffleTemplates(items: MessageTemplateRecord[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function pause(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getFallbackTitle(type: SuggestionType, selectedLanguage: LanguageType) {
  return (
    suggestionOptions.find((option) => option.type === type)?.fallbackTitle[selectedLanguage] ??
    suggestionOptions[0].fallbackTitle[selectedLanguage]
  );
}

function getMockTemplates(type: SuggestionType, selectedLanguage: LanguageType): MessageTemplateRecord[] {
  return mockTemplates[type][selectedLanguage].map((template, index) => ({
    id: `mock-${type}-${selectedLanguage}-${index}`,
    type,
    language: selectedLanguage,
    title: template.title,
    content: template.content,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const maybeMessage = "message" in error ? error.message : null;
    const maybeDetails = "details" in error ? error.details : null;
    const maybeHint = "hint" in error ? error.hint : null;
    const maybeCode = "code" in error ? error.code : null;
    const candidates = [maybeMessage, maybeDetails, maybeHint, maybeCode].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );

    if (candidates.length > 0) {
      return candidates.join(" | ");
    }
  }

  return "AI suggestions are unavailable right now.";
}

function formatAiGeneratorError(error: unknown) {
  const message = getErrorMessage(error);

  if (
    message.includes("Could not find the table 'public.message_templates'") ||
    message.includes("Could not find the table 'public.messages'") ||
    message.includes("404") ||
    message.includes("schema cache")
  ) {
    return "Setup incomplete: Please refresh Supabase schema in Settings -> API -> Refresh";
  }

  if (message.toLowerCase().includes("failed to fetch") || message.includes("ERR_CONNECTION_REFUSED")) {
    return "Connection failed while reaching Supabase. Please check your project URL, API availability, or refresh the schema and try again.";
  }

  if (message.includes("No templates returned from Supabase")) {
    return "No live templates were returned from Supabase. Using local mock templates for now.";
  }

  return message;
}

export default function AnnouncementsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedType, setSelectedType] = useState<SuggestionType>("service");
  const [language, setLanguage] = useState<LanguageType>("sw");
  const [aiResults, setAiResults] = useState<MessageTemplateRecord[]>([]);
  const [aiDraft, setAiDraft] = useState<AIComposerForm>(EMPTY_AI_FORM);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiLoadingMessage, setAiLoadingMessage] = useState("Connecting to AI...");
  const [lastGeneratedAt, setLastGeneratedAt] = useState<number>(0);
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const syncAnnouncementsQuery = (updater: (items: AnnouncementRecord[]) => AnnouncementRecord[]) => {
    if (!churchId) return;
    queryClient.setQueryData<AnnouncementRecord[]>(["announcements", churchId], (current = []) => updater(current));
  };

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements", churchId],
    queryFn: async () => {
      if (!churchId) return [];
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

  const activeAnnouncements = useMemo(
    () => announcements.filter((announcement) => !announcement.archived_at),
    [announcements],
  );
  const archivedAnnouncements = useMemo(
    () => announcements.filter((announcement) => !!announcement.archived_at),
    [announcements],
  );

  const selectedOption = useMemo(
    () => suggestionOptions.find((option) => option.type === selectedType) ?? suggestionOptions[0],
    [selectedType],
  );

  const resetForm = () => setForm(EMPTY_FORM);

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (announcement: AnnouncementRecord) => {
    setForm({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      isPublished: announcement.is_published,
    });
    setDialogOpen(true);
  };

  const saveAnnouncement = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      const { data, error } = await supabase.rpc("save_church_announcement" as never, {
        _announcement_id: form.id,
        _church_id: churchId,
        _title: form.title,
        _content: form.content,
        _is_published: form.isPublished,
      } as never);

      if (error) throw error;

      const result = data as AnnouncementMutationResult | null;
      if (!result?.success) {
        throw new Error(result?.error || "Announcement save failed.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", churchId] });
      queryClient.invalidateQueries({ queryKey: ["portal-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["portal-announcements-all"] });
      queryClient.invalidateQueries({ queryKey: ["dash-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["portal-home"] });
      toast({ title: form.id ? "Announcement updated" : "Announcement created" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      console.error("Failed to save announcement:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const archiveAnnouncement = useMutation({
    mutationFn: async (announcement: AnnouncementRecord) => {
      const { data, error } = await supabase.rpc("set_church_announcement_archived" as never, {
        _announcement_id: announcement.id,
        _archived: !announcement.archived_at,
      } as never);

      if (error) throw error;

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
      queryClient.invalidateQueries({ queryKey: ["announcements", churchId] });
      queryClient.invalidateQueries({ queryKey: ["portal-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["portal-announcements-all"] });
      queryClient.invalidateQueries({ queryKey: ["dash-announcements"] });
      toast({ title: announcement.archived_at ? "Announcement restored" : "Announcement archived" });
    },
    onError: (err: Error) => {
      console.error("Failed to archive announcement:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async (announcement: AnnouncementRecord) => {
      const { data, error } = await supabase.rpc("delete_church_announcement" as never, {
        _announcement_id: announcement.id,
      } as never);

      if (error) throw error;

      const result = data as AnnouncementMutationResult | null;
      if (!result?.success) {
        throw new Error(result?.error || "Announcement delete failed.");
      }
    },
    onSuccess: (_, announcement) => {
      syncAnnouncementsQuery((items) => items.filter((item) => item.id !== announcement.id));
      queryClient.invalidateQueries({ queryKey: ["announcements", churchId] });
      queryClient.invalidateQueries({ queryKey: ["portal-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["portal-announcements-all"] });
      queryClient.invalidateQueries({ queryKey: ["dash-announcements"] });
      toast({ title: "Announcement deleted" });
    },
    onError: (err: Error) => {
      console.error("Failed to delete announcement:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const generateMessages = useMutation({
    mutationFn: async ({
      type,
      selectedLanguage,
      regenerate = false,
    }: {
      type: SuggestionType;
      selectedLanguage: LanguageType;
      regenerate?: boolean;
    }) => {
      setAiLoadingMessage("Connecting to AI...");
      await pause(AI_CONNECTION_DELAY_MS);
      setAiLoadingMessage("Fetching templates...");

      // If the table was created recently, Supabase may still serve a stale schema cache
      // until it is refreshed manually in Dashboard > Settings > API > Refresh.
      const [response] = await Promise.all([
        supabase
          .from("message_templates")
          .select("*")
          .eq("type", type)
          .eq("language", selectedLanguage),
        pause(AI_GENERATION_DELAY_MS),
      ]);

      const { data, error } = response;
      if (error) throw error;

      const templates = (data ?? []) as MessageTemplateRecord[];
      if (templates.length === 0) {
        throw new Error("No templates returned from Supabase for this selection.");
      }

      const shuffled = shuffleTemplates(templates).slice(0, 3);
      return { templates: shuffled, regenerate, type, selectedLanguage, source: "supabase" as const };
    },
    onMutate: ({ type, selectedLanguage }) => {
      setSelectedType(type);
      setLanguage(selectedLanguage);
      setAiError(null);
      setAiNotice(null);
    },
    onSuccess: ({ templates, regenerate, type, selectedLanguage }) => {
      setAiResults(templates);
      setLastGeneratedAt(Date.now());
      setAiNotice(null);

      if (!regenerate) {
        const first = templates[0];
        setAiDraft({
          title: first.title || getFallbackTitle(type, selectedLanguage),
          content: first.content,
        });
      }
    },
    onError: (err: unknown) => {
      console.error("Failed to generate AI announcement:", err);
      const fallbackTemplates = shuffleTemplates(getMockTemplates(selectedType, language)).slice(0, 3);
      setAiResults(fallbackTemplates);
      const formattedError = formatAiGeneratorError(err);
      setAiError(formattedError);
      setAiNotice("Using local mock templates while Supabase is unavailable.");
      setLastGeneratedAt(Date.now());
      if (!aiDraft.content.trim()) {
        const first = fallbackTemplates[0];
        setAiDraft({
          title: first.title || getFallbackTitle(selectedType, language),
          content: first.content,
        });
      }
      toast({ title: "AI suggestions unavailable", description: formattedError, variant: "destructive" });
    },
  });

  const sendGeneratedMessage = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      if (!aiDraft.content.trim()) throw new Error("Choose a template or write a message first.");

      const payload: MessageInsert = {
        church_id: churchId,
        title: aiDraft.title.trim() || getFallbackTitle(selectedType, language),
        content: aiDraft.content.trim(),
        status: "sent",
        language,
        type: selectedType,
        created_by: user?.id ?? null,
      };

      const { error } = await supabase.from("messages").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Message sent", description: "The generated message has been stored as sent." });
      setAiDraft(EMPTY_AI_FORM);
    },
    onError: (err: unknown) => {
      console.error("Failed to send generated message:", err);
      toast({ title: "Send failed", description: formatAiGeneratorError(err), variant: "destructive" });
    },
  });

  const handleGenerate = (type: SuggestionType, regenerate = false) => {
    generateMessages.mutate({ type, selectedLanguage: language, regenerate });
  };

  const useTemplate = (template: MessageTemplateRecord) => {
    setAiDraft({
      title: template.title || getFallbackTitle(selectedType, language),
      content: template.content,
    });
  };

  const AnnouncementCard = ({ announcement }: { announcement: AnnouncementRecord }) => (
    <Card key={announcement.id} className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{announcement.title}</h3>
              <Badge
                variant="outline"
                className={
                  announcement.archived_at
                    ? "border-border text-muted-foreground"
                    : announcement.is_published
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-400/20 bg-amber-500/10 text-amber-200"
                }
              >
                {announcement.archived_at ? "Archived" : announcement.is_published ? "Published" : "Draft"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{announcement.content}</p>
            <p className="mt-2 text-xs text-muted-foreground/60">
              {new Date(announcement.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Announcements</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage church announcements and AI-crafted message ideas.</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">{form.id ? "Edit Announcement" : "Create Announcement"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveAnnouncement.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  placeholder="Announcement title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Content *</Label>
                <Textarea
                  rows={4}
                  placeholder="Announcement details..."
                  value={form.content}
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="publish"
                  checked={form.isPublished}
                  onCheckedChange={(value) => setForm((current) => ({ ...current, isPublished: value }))}
                />
                <Label htmlFor="publish">Publish immediately</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveAnnouncement.isPending || !form.title || !form.content}>
                  {saveAnnouncement.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {form.id ? "Save Changes" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="overflow-hidden border-amber-400/20 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_38%),linear-gradient(180deg,rgba(17,17,20,0.98),rgba(10,10,12,0.96))] shadow-[0_0_30px_rgba(212,175,55,0.12)] backdrop-blur-xl">
          <CardHeader className="border-b border-white/5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-200 shadow-[0_0_20px_rgba(212,175,55,0.18)]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-amber-200/80">Ask AI</p>
                    <CardTitle className="font-serif text-2xl text-foreground">Announcement Generator</CardTitle>
                  </div>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Pick a church moment, let the assistant pull message templates from Supabase, then refine and send the final copy.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-md">
                <ToggleGroup
                  type="single"
                  value={language}
                  onValueChange={(value) => {
                    if (value === "sw" || value === "en") {
                      setLanguage(value);
                      if (aiResults.length > 0) {
                        generateMessages.mutate({
                          type: selectedType,
                          selectedLanguage: value,
                          regenerate: true,
                        });
                      }
                    }
                  }}
                  className="gap-1"
                >
                  <ToggleGroupItem
                    value="sw"
                    className="rounded-xl border-0 px-4 py-2 text-xs uppercase tracking-[0.28em] data-[state=on]:bg-amber-400 data-[state=on]:text-black"
                  >
                    SW
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="en"
                    className="rounded-xl border-0 px-4 py-2 text-xs uppercase tracking-[0.28em] data-[state=on]:bg-amber-400 data-[state=on]:text-black"
                  >
                    EN
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            <div className="flex flex-wrap gap-3">
              {suggestionOptions.map((option) => {
                const isSelected = option.type === selectedType;
                return (
                  <motion.div key={option.type} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleGenerate(option.type)}
                      disabled={generateMessages.isPending}
                      className={[
                        "rounded-full border-white/10 bg-white/5 px-5 text-sm text-muted-foreground transition-all duration-300",
                        "hover:border-amber-300/40 hover:bg-amber-400/10 hover:text-amber-100 hover:shadow-[0_0_24px_rgba(212,175,55,0.16)]",
                        isSelected ? "border-amber-300/40 bg-amber-400/10 text-amber-100" : "",
                      ].join(" ")}
                    >
                      {option.label}
                    </Button>
                  </motion.div>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {generateMessages.isPending ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="rounded-3xl border border-amber-400/20 bg-black/20 p-6"
                >
                  <div className="flex items-center gap-3 text-amber-100">
                    <WandSparkles className="h-5 w-5" />
                    <p className="font-medium">{aiLoadingMessage}</p>
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((index) => (
                        <motion.span
                          key={index}
                          className="h-2 w-2 rounded-full bg-amber-300"
                          animate={{ opacity: [0.25, 1, 0.25], y: [0, -4, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.12 }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Pulling {language.toUpperCase()} templates for {selectedOption.label.toLowerCase()}.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-6"
                >
                  <div className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="font-serif text-xl text-foreground">Generated variations</h2>
                          <p className="text-sm text-muted-foreground">
                            Choose one, then fine-tune it before sending. Results are shuffled from Supabase templates to feel freshly generated.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleGenerate(selectedType, true)}
                          disabled={generateMessages.isPending || aiResults.length === 0}
                          className="rounded-full border-amber-400/25 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Regenerate
                        </Button>
                      </div>

                      {aiError && (
                        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                          <p>{aiError}</p>
                          <div className="mt-3">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleGenerate(selectedType)}
                              disabled={generateMessages.isPending}
                              className="rounded-full border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                            >
                              Retry loading templates
                            </Button>
                          </div>
                        </div>
                      )}

                      {aiNotice && (
                        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                          {aiNotice}
                        </div>
                      )}

                      {aiResults.length === 0 ? (
                        <Card className="border-dashed border-white/10 bg-black/20">
                          <CardContent className="py-12 text-center text-muted-foreground">
                            <Sparkles className="mx-auto mb-4 h-10 w-10 text-amber-200/35" />
                            Tap a suggestion above to generate 2-3 polished message variations.
                            <div className="mt-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleGenerate(selectedType)}
                                disabled={generateMessages.isPending}
                                className="rounded-full border-white/10 bg-white/5"
                              >
                                Retry loading templates
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                          {aiResults.map((template, index) => (
                            <motion.div
                              key={`${template.id}-${lastGeneratedAt}-${index}`}
                              initial={{ opacity: 0, y: 18 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.08 }}
                            >
                              <Card className="h-full border-white/10 bg-white/[0.03] shadow-[0_16px_30px_rgba(0,0,0,0.18)]">
                                <CardContent className="flex h-full flex-col gap-4 p-5">
                                  <div className="flex items-center justify-between gap-3">
                                    <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 text-amber-100">
                                      Variation {index + 1}
                                    </Badge>
                                    <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                      {template.language}
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    <h3 className="font-semibold text-foreground">
                                      {template.title || getFallbackTitle(selectedType, language)}
                                    </h3>
                                    <p className="text-sm leading-6 text-muted-foreground">{template.content}</p>
                                  </div>
                                  <div className="mt-auto">
                                    <Button
                                      type="button"
                                      onClick={() => useTemplate(template)}
                                      className="w-full rounded-xl bg-amber-400 text-black hover:bg-amber-300"
                                    >
                                      Use this
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>

                    <motion.div
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="rounded-[28px] border border-amber-400/20 bg-white/[0.04] p-5 shadow-[0_0_20px_rgba(212,175,55,0.12)] backdrop-blur-lg"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-amber-200/80">Edit Mode</p>
                          <h3 className="mt-2 font-serif text-xl text-foreground">Refine before sending</h3>
                        </div>
                        <Badge variant="outline" className="border-white/10 bg-black/20 text-muted-foreground">
                          status: draft
                        </Badge>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-foreground">Title</Label>
                          <Input
                            value={aiDraft.title}
                            onChange={(event) => setAiDraft((current) => ({ ...current, title: event.target.value }))}
                            placeholder={getFallbackTitle(selectedType, language)}
                            className="border-white/10 bg-black/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-foreground">Message</Label>
                          <Textarea
                            rows={10}
                            value={aiDraft.content}
                            onChange={(event) => setAiDraft((current) => ({ ...current, content: event.target.value }))}
                            placeholder="Generated message will appear here..."
                            className="border-white/10 bg-black/30"
                          />
                        </div>
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100/85">
                          AI style note: templates are fetched from Supabase and shuffled to feel freshly generated each time.
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button
                            type="button"
                            onClick={() => sendGeneratedMessage.mutate()}
                            disabled={sendGeneratedMessage.isPending || !aiDraft.content.trim()}
                            className="flex-1 rounded-xl bg-amber-400 text-black hover:bg-amber-300"
                          >
                            {sendGeneratedMessage.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="mr-2 h-4 w-4" />
                            )}
                            Send Message
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setForm({
                                id: null,
                                title: aiDraft.title.trim() || getFallbackTitle(selectedType, language),
                                content: aiDraft.content,
                                isPublished: false,
                              });
                              setDialogOpen(true);
                            }}
                            disabled={!aiDraft.content.trim()}
                            className="rounded-xl border-white/10 bg-white/5"
                          >
                            Save as announcement
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.section>

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
                <CardContent className="py-8 text-center text-muted-foreground">No active announcements.</CardContent>
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
