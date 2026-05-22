import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Building2, FileText, Loader2, MessageSquare, Paperclip, Plus, Send, Shield, SmilePlus, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { resolveChannelRecipients, type ChannelAudienceType, type ChannelRecord, getChannelAudienceLabel } from "@/lib/channels";
import { formatBytes, uploadFile, validateFile } from "@/lib/file-upload";
import { useToast } from "@/hooks/use-toast";

type WorkspaceScope = "church_admin" | "community_leader" | "member";

interface ChannelWorkspaceProps {
  scope: WorkspaceScope;
  churchId: string;
  userId: string;
  memberId?: string | null;
  communityId?: string | null;
  title: string;
  description: string;
}

const ADMIN_AUDIENCE_OPTIONS: Array<{ value: ChannelAudienceType; label: string }> = [
  { value: "ministry", label: "One ministry" },
  { value: "community_leaders", label: "Leaders from one community" },
  { value: "all_community_leaders", label: "Leaders from all communities" },
  { value: "admin_roles", label: "Administrative roles" },
];

const COMMUNITY_AUDIENCE_OPTIONS: Array<{ value: ChannelAudienceType; label: string }> = [
  { value: "community_leaders", label: "Leaders in this community" },
  { value: "community_members", label: "All people in this community" },
];

const ADMIN_ROLE_OPTIONS = [
  { value: "church_admin", label: "Church Admins" },
  { value: "pastor", label: "Pastors" },
  { value: "secretary", label: "Secretaries" },
  { value: "treasurer", label: "Treasurers" },
];

const CHAT_REACTION_EMOJIS = ["👍", "❤️", "🙏", "🎉", "🔥", "😊"] as const;

export function ChannelWorkspace({
  scope,
  churchId,
  userId,
  memberId,
  communityId,
  title,
  description,
}: ChannelWorkspaceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [audienceType, setAudienceType] = useState<ChannelAudienceType>(
    scope === "church_admin" ? "ministry" : "community_members",
  );
  const [selectedMinistryId, setSelectedMinistryId] = useState("");
  const [selectedCommunityId, setSelectedCommunityId] = useState(communityId || "");
  const [selectedAdminRoles, setSelectedAdminRoles] = useState<string[]>(["pastor", "treasurer"]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const canUploadAttachments = scope !== "member";
  const composerPlaceholder = canUploadAttachments
    ? "Type an update, report, or discussion message..."
    : "Type your message...";

  const audienceOptions = scope === "church_admin" ? ADMIN_AUDIENCE_OPTIONS : COMMUNITY_AUDIENCE_OPTIONS;

  const { data: ministries = [] } = useQuery({
    queryKey: ["channel-ministries", churchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ministries")
        .select("id, name")
        .eq("church_id", churchId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: scope === "church_admin",
  });

  const { data: communities = [] } = useQuery({
    queryKey: ["channel-communities", churchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("id, name")
        .eq("church_id", churchId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: scope !== "member",
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ["chat-memberships", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_channel_members" as never)
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: !!userId,
    refetchInterval: 5000,
  });

  const {
    data: channels = [],
    isLoading: loadingChannels,
    error: channelsError,
  } = useQuery({
    queryKey: ["chat-channels", scope, churchId, userId, communityId],
    queryFn: async () => {
      let query = supabase
        .from("chat_channels" as never)
        .select("*")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });

      if (scope === "community_leader" && communityId) {
        query = query.eq("community_id", communityId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = ((data as any[]) ?? []) as ChannelRecord[];

      if (scope === "member") {
        const memberChannelIds = new Set(memberships.map((row: any) => row.channel_id));
        return rows.filter((row) => memberChannelIds.has(row.id));
      }

      return rows;
    },
    enabled: !!churchId && !!userId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0].id);
      return;
    }

    if (selectedChannelId && !channels.some((channel) => channel.id === selectedChannelId)) {
      setSelectedChannelId(channels[0]?.id || "");
    }
  }, [channels, selectedChannelId]);

  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) || null;

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["chat-messages", selectedChannelId],
    queryFn: async () => {
      if (!selectedChannelId) return [];

      const { data, error } = await supabase
        .from("chat_messages" as never)
        .select("*")
        .eq("channel_id", selectedChannelId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = (data as any[]) ?? [];
      const senderIds = [...new Set(rows.map((message) => message.sender_user_id).filter(Boolean))];
      const messageIds = rows.map((message) => message.id);

      const { data: profiles } = senderIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", senderIds)
        : { data: [] };

      const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile.full_name || "User"]));
      const { data: reactions, error: reactionsError } = messageIds.length
        ? await supabase
            .from("chat_message_reactions" as never)
            .select("message_id, user_id, emoji")
            .in("message_id", messageIds)
        : { data: [], error: null };

      if (reactionsError) throw reactionsError;

      const reactionMap = new Map<string, Array<{ emoji: string; count: number; reacted: boolean }>>();
      const groupedReactions = new Map<string, Map<string, Set<string>>>();

      ((reactions as any[]) ?? []).forEach((reaction) => {
        if (!groupedReactions.has(reaction.message_id)) {
          groupedReactions.set(reaction.message_id, new Map());
        }

        const emojiMap = groupedReactions.get(reaction.message_id)!;
        if (!emojiMap.has(reaction.emoji)) {
          emojiMap.set(reaction.emoji, new Set());
        }

        emojiMap.get(reaction.emoji)!.add(reaction.user_id);
      });

      groupedReactions.forEach((emojiMap, messageId) => {
        reactionMap.set(
          messageId,
          Array.from(emojiMap.entries()).map(([emoji, userIds]) => ({
            emoji,
            count: userIds.size,
            reacted: userIds.has(userId),
          })),
        );
      });

      return rows.map((message) => ({
        ...message,
        sender_name: profileMap.get(message.sender_user_id) || "User",
        reactions: reactionMap.get(message.id) ?? [],
      }));
    },
    enabled: !!selectedChannelId,
    refetchInterval: 4000,
  });

  const createChannel = useMutation({
    mutationFn: async () => {
      if (!channelName.trim()) throw new Error("Channel name is required.");

      const resolvedCommunityId = scope === "community_leader" ? communityId || selectedCommunityId : selectedCommunityId;

      const recipients = await resolveChannelRecipients({
        churchId,
        audienceType,
        ministryId: selectedMinistryId || null,
        communityId: resolvedCommunityId || null,
        adminRoles: selectedAdminRoles,
      });

      if (recipients.length === 0) {
        throw new Error("No registered recipients were found for this channel.");
      }

      const payload = {
        church_id: churchId,
        name: channelName.trim(),
        description: channelDescription.trim() || null,
        owner_scope: scope === "church_admin" ? "church_admin" : "community_leader",
        audience_type: audienceType,
        community_id: resolvedCommunityId || null,
        ministry_id: selectedMinistryId || null,
        metadata: audienceType === "admin_roles" ? { admin_roles: selectedAdminRoles } : {},
        created_by: userId,
      };

      const { data: insertedChannel, error } = await supabase
        .from("chat_channels" as never)
        .insert(payload as never)
        .select("*")
        .single();

      if (error) throw error;

      const channel = insertedChannel as unknown as ChannelRecord;
      const memberRows = await supabase
        .from("members")
        .select("id, user_id")
        .eq("user_id", userId)
        .eq("church_id", churchId)
        .limit(1)
        .maybeSingle();

      const membershipsPayload = [
        ...recipients,
        {
          user_id: userId,
          member_id: memberRows.data?.id ?? memberId ?? null,
        },
      ]
        .filter((recipient, index, array) => recipient.user_id && array.findIndex((row) => row.user_id === recipient.user_id) === index)
        .map((recipient) => ({
          channel_id: channel.id,
          user_id: recipient.user_id,
          member_id: recipient.member_id,
        }));

      const { error: membershipError } = await supabase
        .from("chat_channel_members" as never)
        .insert(membershipsPayload as never);

      if (membershipError) throw membershipError;

      return channel;
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ["chat-channels"] });
      queryClient.invalidateQueries({ queryKey: ["chat-memberships"] });
      toast({ title: "Channel created", description: `${channel.name} is ready for updates.` });
      setCreateOpen(false);
      setSelectedChannelId(channel.id);
      setChannelName("");
      setChannelDescription("");
      setSelectedMinistryId("");
      setSelectedCommunityId(communityId || "");
      setSelectedAdminRoles(["pastor", "treasurer"]);
    },
    onError: (error: any) => {
      toast({ title: "Unable to create channel", description: error.message, variant: "destructive" });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!selectedChannelId) throw new Error("Choose a channel first.");
      if (!newMessage.trim() && !attachmentFile) throw new Error("Add a message or attach a PDF first.");
      if (attachmentFile && !canUploadAttachments) throw new Error("Only leaders can upload files in channels.");

      let attachmentPayload: Record<string, any> = {};

      if (attachmentFile) {
        const validation = validateFile(attachmentFile, "channel-attachment");
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        const sanitizedName = attachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const uploadResult = await uploadFile(
          attachmentFile,
          "channel-attachment",
          churchId,
          `${selectedChannelId}/${Date.now()}-${sanitizedName}`,
        );

        attachmentPayload = {
          attachment_name: attachmentFile.name,
          attachment_url: uploadResult.publicUrl,
          attachment_type: attachmentFile.type || "application/pdf",
          attachment_size: attachmentFile.size,
        };
      }

      const { error } = await supabase
        .from("chat_messages" as never)
        .insert({
          channel_id: selectedChannelId,
          sender_user_id: userId,
          sender_member_id: memberId || null,
          body: newMessage.trim() || null,
          ...attachmentPayload,
        } as never);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", selectedChannelId] });
      setNewMessage("");
      setAttachmentFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Unable to send message", description: error.message, variant: "destructive" });
    },
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ messageId, emoji, reacted }: { messageId: string; emoji: string; reacted: boolean }) => {
      if (reacted) {
        const { error } = await supabase
          .from("chat_message_reactions" as never)
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", userId);

        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("chat_message_reactions" as never)
        .upsert({
          message_id: messageId,
          user_id: userId,
          emoji,
        } as never, { onConflict: "message_id,user_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", selectedChannelId] });
    },
    onError: (error: any) => {
      toast({ title: "Unable to save reaction", description: error.message, variant: "destructive" });
    },
  });

  const emptyIcon = scope === "church_admin" ? Shield : scope === "community_leader" ? Building2 : Bell;
  const EmptyIcon = emptyIcon;

  const selectedAudienceSummary = useMemo(() => {
    if (audienceType === "ministry") return ministries.find((row: any) => row.id === selectedMinistryId)?.name || "Choose a ministry";
    if (audienceType === "community_leaders") return communities.find((row: any) => row.id === (communityId || selectedCommunityId))?.name || "Choose a community";
    if (audienceType === "admin_roles") {
      return selectedAdminRoles.length > 0
        ? selectedAdminRoles.map((role) => ADMIN_ROLE_OPTIONS.find((item) => item.value === role)?.label || role).join(", ")
        : "Choose roles";
    }
    if (audienceType === "community_members") return communities.find((row: any) => row.id === (communityId || selectedCommunityId))?.name || "Current community";
    return "All communities";
  }, [audienceType, communities, communityId, ministries, selectedAdminRoles, selectedCommunityId, selectedMinistryId]);

  const createChannelButton = scope !== "member" ? (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Create Channel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Channel name</Label>
            <Input value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="Monthly reports" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={channelDescription} onChange={(event) => setChannelDescription(event.target.value)} rows={3} placeholder="Purpose of this channel..." />
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={audienceType} onValueChange={(value: ChannelAudienceType) => setAudienceType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose audience" />
              </SelectTrigger>
              <SelectContent>
                {audienceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {scope === "church_admin" && audienceType === "ministry" && (
            <div className="space-y-2">
              <Label>Ministry</Label>
              <Select value={selectedMinistryId} onValueChange={setSelectedMinistryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ministry" />
                </SelectTrigger>
                <SelectContent>
                  {ministries.map((ministry: any) => (
                    <SelectItem key={ministry.id} value={ministry.id}>
                      {ministry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === "church_admin" && audienceType === "community_leaders" && (
            <div className="space-y-2">
              <Label>Community</Label>
              <Select value={selectedCommunityId} onValueChange={setSelectedCommunityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select community" />
                </SelectTrigger>
                <SelectContent>
                  {communities.map((community: any) => (
                    <SelectItem key={community.id} value={community.id}>
                      {community.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === "church_admin" && audienceType === "admin_roles" && (
            <div className="space-y-2">
              <Label>Administrative roles</Label>
              <div className="grid grid-cols-2 gap-2">
                {ADMIN_ROLE_OPTIONS.map((role) => {
                  const checked = selectedAdminRoles.includes(role.value);
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() =>
                        setSelectedAdminRoles((current) =>
                          checked ? current.filter((item) => item !== role.value) : [...current, role.value],
                        )
                      }
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/20"
                      }`}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recipients</p>
            <p className="mt-2 text-sm font-medium">{selectedAudienceSummary}</p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => createChannel.mutate()} disabled={createChannel.isPending || !channelName.trim()}>
              {createChannel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Channel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  const handleAttachmentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const validation = validateFile(file, "channel-attachment");
    if (!validation.valid) {
      toast({ title: "Invalid attachment", description: validation.error, variant: "destructive" });
      event.target.value = "";
      return;
    }

    setAttachmentFile(file);
    event.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        {createChannelButton}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Channels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingChannels ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : channelsError ? (
              <div className="py-8 text-center text-muted-foreground">
                <EmptyIcon className="h-10 w-10 mx-auto mb-3 text-destructive/50" />
                <p className="text-sm font-medium text-foreground">We could not load channels.</p>
                <p className="mt-1 text-xs">{channelsError instanceof Error ? channelsError.message : "Please refresh and try again."}</p>
              </div>
            ) : channels.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <EmptyIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm">No channels yet.</p>
                {scope !== "member" && (
                  <div className="mt-4 flex justify-center">
                    {createChannelButton}
                  </div>
                )}
              </div>
            ) : (
              channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannelId(channel.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    selectedChannelId === channel.id
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-muted/20 hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{channel.name}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{channel.description || "No description yet."}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {getChannelAudienceLabel(channel)}
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-card min-h-[520px]">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base">
              {selectedChannel ? selectedChannel.name : "Channel conversation"}
            </CardTitle>
            {selectedChannel && (
              <p className="text-sm text-muted-foreground">
                {selectedChannel.description || getChannelAudienceLabel(selectedChannel)}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {!selectedChannel ? (
              <div className="flex min-h-[420px] items-center justify-center text-center text-muted-foreground">
                <div>
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p>Select a channel to start reading updates.</p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[520px] flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto p-5">
                  {loadingMessages ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p>No messages yet. Start this channel with a message.</p>
                    </div>
                  ) : (
                    messages.map((message: any) => {
                      const mine = message.sender_user_id === userId;
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${mine ? "bg-primary text-primary-foreground" : "bg-muted/40"}`}>
                            <div className={`text-xs font-medium ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                              {mine ? "You" : message.sender_name}
                            </div>
                            {message.body && <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>}
                            {message.attachment_url && (
                              <a
                                href={message.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className={`mt-3 flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${
                                  mine
                                    ? "border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/15"
                                    : "border-border/60 bg-background/40 hover:bg-background/60"
                                }`}
                              >
                                <div className={`rounded-lg p-2 ${mine ? "bg-primary-foreground/10" : "bg-primary/10"}`}>
                                  <FileText className={`h-4 w-4 ${mine ? "text-primary-foreground" : "text-primary"}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">{message.attachment_name || "Attached PDF"}</p>
                                  <p className={`text-xs ${mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                                    {message.attachment_size ? formatBytes(Number(message.attachment_size)) : "PDF document"}
                                  </p>
                                </div>
                              </a>
                            )}
                            <p className={`mt-2 text-[11px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}>
                              {new Date(message.created_at).toLocaleString()}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {message.reactions?.map((reaction: any) => (
                                <Button
                                  key={`${message.id}-${reaction.emoji}`}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={`h-8 rounded-full px-2 text-xs ${
                                    reaction.reacted
                                      ? mine
                                        ? "border-primary-foreground/40 bg-primary-foreground/15 text-primary-foreground"
                                        : "border-primary/40 bg-primary/10 text-primary"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    toggleReaction.mutate({
                                      messageId: message.id,
                                      emoji: reaction.emoji,
                                      reacted: reaction.reacted,
                                    })
                                  }
                                  disabled={toggleReaction.isPending}
                                >
                                  <span className="mr-1">{reaction.emoji}</span>
                                  {reaction.count}
                                </Button>
                              ))}
                              {CHAT_REACTION_EMOJIS.map((emoji) => {
                                const existingReaction = message.reactions?.find((reaction: any) => reaction.emoji === emoji);
                                if (existingReaction) return null;

                                return (
                                  <Button
                                    key={`${message.id}-picker-${emoji}`}
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 rounded-full px-2 text-xs ${mine ? "text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground" : ""}`}
                                    onClick={() =>
                                      toggleReaction.mutate({
                                        messageId: message.id,
                                        emoji,
                                        reacted: false,
                                      })
                                    }
                                    disabled={toggleReaction.isPending}
                                  >
                                    {emoji}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="border-t border-border/50 p-4">
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handleAttachmentSelect}
                  />
                  {attachmentFile && (
                    <div className="mb-3 flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{attachmentFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(attachmentFile.size)}</p>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setAttachmentFile(null)}>
                        Remove
                      </Button>
                    </div>
                  )}
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <SmilePlus className="h-3.5 w-3.5" />
                    React with emojis on any message.
                    {!canUploadAttachments && <span>Members can chat only.</span>}
                  </div>
                  <div className="flex gap-3">
                    <Textarea
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      rows={3}
                      placeholder={composerPlaceholder}
                    />
                    {canUploadAttachments && (
                      <Button
                        type="button"
                        variant="outline"
                        className="self-end"
                        onClick={() => attachmentInputRef.current?.click()}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      className="self-end"
                      onClick={() => sendMessage.mutate()}
                      disabled={sendMessage.isPending || (!newMessage.trim() && !attachmentFile)}
                    >
                      {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
