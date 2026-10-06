import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/i18n";
import { formatAppDate } from "@/lib/localization";

const state = vi.hoisted(() => ({
  mode: "data" as "data" | "empty" | "error",
  queryKeys: [] as Array<readonly unknown[]>,
  mutationCalls: [] as string[],
  invalidateQueries: vi.fn(),
  channels: [
    {
      id: "channel-a",
      church_id: "church-a",
      name: "Dynamic Channel Name",
      description: "Dynamic channel description",
      audience_type: "community_members",
      owner_scope: "community_leader",
      community_id: "community-a",
      ministry_id: null,
      metadata: null,
      created_by: "leader-a",
      created_at: "2026-10-05T08:00:00Z",
    },
    {
      id: "channel-b",
      church_id: "church-a",
      name: "Leadership Dynamic Channel",
      description: null,
      audience_type: "admin_roles",
      owner_scope: "church_admin",
      community_id: null,
      ministry_id: null,
      metadata: null,
      created_by: "admin-a",
      created_at: "2026-10-04T08:00:00Z",
    },
  ],
  messages: [
    {
      id: "message-a",
      channel_id: "channel-a",
      sender_user_id: "user-a",
      sender_member_id: "member-a",
      sender_name: "Dynamic Self Name",
      body: "Dynamic member message body",
      created_at: "2026-10-05T09:30:00Z",
      attachment_name: null,
      attachment_url: null,
      attachment_type: null,
      attachment_size: null,
      reactions: [],
    },
    {
      id: "message-b",
      channel_id: "channel-a",
      sender_user_id: "user-b",
      sender_member_id: "member-b",
      sender_name: "Dynamic Sender Name",
      body: "Dynamic sender message body",
      created_at: "2026-10-05T10:30:00Z",
      attachment_name: null,
      attachment_url: "https://files.example/report.pdf",
      attachment_type: "application/pdf",
      attachment_size: null,
      reactions: [{ emoji: "👍", count: 2, reacted: false }],
    },
  ],
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: state.invalidateQueries }),
  useQuery: (options: { queryKey: readonly unknown[] }) => {
    state.queryKeys.push(options.queryKey);
    const key = options.queryKey[0];
    if (key === "chat-memberships") {
      return { data: [{ channel_id: "channel-a" }, { channel_id: "channel-b" }], isSuccess: true };
    }
    if (key === "chat-channels") {
      if (state.mode === "error") return { data: [], isLoading: false, error: new Error("raw channel lookup") };
      return { data: state.mode === "empty" ? [] : state.channels, isLoading: false, error: null };
    }
    return { data: [], isLoading: false, error: null, isSuccess: true };
  },
  useInfiniteQuery: () => ({
    data: { pages: [{ messages: state.messages, nextCursor: "2026-10-05T09:30:00Z" }] },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: true,
    fetchNextPage: vi.fn(),
  }),
  useMutation: (options: { mutationFn?: () => unknown }) => ({
    mutate: () => {
      state.mutationCalls.push(String(options.mutationFn));
    },
    isPending: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => {
      const channel = { on: () => channel, subscribe: vi.fn() };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/file-upload", () => ({
  formatBytes: (value: number) => `${value} bytes`,
  uploadFile: vi.fn(),
  validateFile: () => ({ valid: true }),
}));

import { ChannelWorkspace } from "@/components/channels/ChannelWorkspace";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const flattenKeys = (value: unknown, prefix = ""): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) => flattenKeys(nested, prefix ? `${prefix}.${key}` : key));
};
const waitFor = async (predicate: () => boolean) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("Timed out waiting for member Channels state.");
};

describe("member Channels localization", () => {
  let host: HTMLDivElement;
  let root: Root;

  const renderWorkspace = (title: string, description: string) => {
    act(() => {
      root.render(
        <ChannelWorkspace
          scope="member"
          churchId="church-a"
          userId="user-a"
          memberId="member-a"
          title={title}
          description={description}
        />,
      );
    });
  };

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    state.mode = "data";
    state.queryKeys = [];
    state.mutationCalls = [];
    state.invalidateQueries.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("keeps English and Kiswahili member_channels keys symmetric", () => {
    const en = JSON.parse(read("src/locales/en.json"));
    const sw = JSON.parse(read("src/locales/sw.json"));

    expect(flattenKeys(en.member_channels).sort()).toEqual(flattenKeys(sw.member_channels).sort());
  });

  it("passes localized PortalChannels title and description", () => {
    const portalChannels = read("src/pages/portal/PortalChannels.tsx");

    expect(portalChannels).toContain('title={t("member_channels.title")}');
    expect(portalChannels).toContain('description={t("member_channels.description")}');
  });

  it("renders English member channel UI while preserving dynamic content", async () => {
    await changeAppLanguage("en");

    renderWorkspace("Channels", "Stay aligned with ministry, community, and leadership updates in one place.");
    await waitFor(() => host.textContent?.includes("Dynamic member message body") === true);

    expect(host.textContent).toContain("Channels");
    expect(host.textContent).toContain("Stay aligned with ministry, community, and leadership updates in one place.");
    expect(host.textContent).toContain("No description yet.");
    expect(host.textContent).toContain("Community Members");
    expect(host.textContent).toContain("Administrative Team");
    expect(host.textContent).toContain("Load earlier messages");
    expect(host.textContent).toContain("You");
    expect(host.textContent).toContain("Dynamic Channel Name");
    expect(host.textContent).toContain("Dynamic channel description");
    expect(host.textContent).toContain("Dynamic member message body");
    expect(host.textContent).toContain("Dynamic Sender Name");
    expect(host.textContent).toContain("Dynamic sender message body");
    expect(host.textContent).toContain("Attached PDF");
    expect(host.textContent).toContain("PDF document");
    expect(host.textContent).toContain("React with emojis on any message.");
    expect(host.textContent).toContain("Members can chat only.");
    expect(host.querySelector('textarea[placeholder="Type your message..."]')).not.toBeNull();
    expect(host.textContent).toContain(formatAppDate("2026-10-05T09:30:00Z", "en", { dateStyle: "medium", timeStyle: "short" }));
  });

  it("renders Kiswahili member channel UI while preserving dynamic content", async () => {
    await changeAppLanguage("sw");

    renderWorkspace("Mawasiliano", "Endelea kupata taarifa za huduma, jumuiya, na uongozi mahali pamoja.");
    await waitFor(() => host.textContent?.includes("Dynamic member message body") === true);

    expect(host.textContent).toContain("Mawasiliano");
    expect(host.textContent).toContain("Endelea kupata taarifa za huduma, jumuiya, na uongozi mahali pamoja.");
    expect(host.textContent).toContain("Hakuna maelezo bado.");
    expect(host.textContent).toContain("Wanachama wa Jumuiya");
    expect(host.textContent).toContain("Timu ya Utawala");
    expect(host.textContent).toContain("Pakia ujumbe wa awali");
    expect(host.textContent).toContain("Wewe");
    expect(host.textContent).toContain("Dynamic Channel Name");
    expect(host.textContent).toContain("Dynamic channel description");
    expect(host.textContent).toContain("Dynamic member message body");
    expect(host.textContent).toContain("Dynamic Sender Name");
    expect(host.textContent).toContain("Dynamic sender message body");
    expect(host.textContent).toContain("PDF iliyoambatishwa");
    expect(host.textContent).toContain("Hati ya PDF");
    expect(host.textContent).toContain("Tumia emoji kujibu ujumbe wowote.");
    expect(host.textContent).toContain("Wanachama wanaweza kutuma ujumbe pekee.");
    expect(host.querySelector('textarea[placeholder="Andika ujumbe wako..."]')).not.toBeNull();
    expect(host.textContent).toContain(formatAppDate("2026-10-05T09:30:00Z", "sw", { dateStyle: "medium", timeStyle: "short" }));
  });

  it("localizes member empty and error states without exposing member create controls", async () => {
    await changeAppLanguage("sw");
    state.mode = "empty";

    renderWorkspace("Mawasiliano", "Endelea kupata taarifa za huduma, jumuiya, na uongozi mahali pamoja.");
    await waitFor(() => host.textContent?.includes("Hakuna mawasiliano bado.") === true);

    expect(host.textContent).toContain("Mazungumzo ya kituo");
    expect(host.textContent).toContain("Chagua kituo ili uanze kusoma taarifa.");
    expect(host.textContent).not.toContain("Create Channel");

    state.mode = "error";
    renderWorkspace("Mawasiliano", "Endelea kupata taarifa za huduma, jumuiya, na uongozi mahali pamoja.");
    await waitFor(() => host.textContent?.includes("Hatukuweza kupakia mawasiliano.") === true);
    expect(host.textContent).toContain("Tafadhali pakia upya na ujaribu tena.");
    expect(host.textContent).not.toContain("raw channel lookup");
  });

  it("preserves member filtering, query scoping, and attachment restrictions", () => {
    const workspace = read("src/components/channels/ChannelWorkspace.tsx");
    const channelsLib = read("src/lib/channels.ts");

    expect(workspace).toContain('queryKey: ["chat-channels", scope, churchId, userId, communityId]');
    expect(workspace).toContain('.eq("church_id", churchId)');
    expect(workspace).toContain('if (scope === "member")');
    expect(workspace).toContain("memberChannelIds.has(row.id)");
    expect(workspace).toContain('const canUploadAttachments = scope !== "member";');
    expect(workspace).toContain("{canUploadAttachments && (");
    expect(workspace).toContain("formatAppDate(createdAt, i18n.language");
    for (const value of ["ministry", "community_leaders", "all_community_leaders", "admin_roles", "community_members"]) {
      expect(channelsLib).toContain(`"${value}"`);
    }
  });
});
