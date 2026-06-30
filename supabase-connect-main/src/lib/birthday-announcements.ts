import { supabase } from "@/integrations/supabase/client";
import { logInfo, logWarning } from "@/lib/error-logger";

type BirthdayAnnouncementResult = {
  success?: boolean;
  error?: string;
  birthday_members_count?: number;
  created_count?: number;
  skipped_count?: number;
};

type BirthdayMember = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
};

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isMissingRpc(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const record = error as { code?: string; message?: string; details?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""}`.toLowerCase();

  return record.code === "PGRST202" || text.includes("schema cache") || text.includes("could not find the function");
}

function isBirthdayToday(member: BirthdayMember, today: Date) {
  if (!member.date_of_birth) return false;

  const dob = new Date(member.date_of_birth);

  return dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
}

async function ensureBirthdayAnnouncementsFromClient(churchId: string) {
  const today = new Date();
  const todayDateString = getLocalDateString(today);

  const { data: membersData, error: membersError } = await supabase
    .from("members")
    .select("id, full_name, date_of_birth")
    .eq("church_id", churchId)
    .eq("status", "active")
    .not("date_of_birth", "is", null)
    .limit(200);

  if (membersError) throw membersError;

  const members = ((membersData ?? []) as BirthdayMember[]);
  const birthdayMembers = members.filter((member) => isBirthdayToday(member, today));
  let createdCount = 0;
  let skippedCount = 0;

  for (const member of birthdayMembers) {
    const content = `Happy Birthday ${member.full_name} 🎉 May God bless you with joy, good health, and many more years.`;
    const dayStart = `${todayDateString}T00:00:00`;
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1);
    const nextDayString = `${getLocalDateString(nextDay)}T00:00:00`;

    const { data: existing, error: existingError } = await supabase
      .from("announcements")
      .select("id")
      .eq("church_id", churchId)
      .eq("title", "Birthday 🎉")
      .eq("content", content)
      .gte("created_at", dayStart)
      .lt("created_at", nextDayString)
      .limit(1);

    if (existingError) throw existingError;

    if ((existing ?? []).length > 0) {
      skippedCount += 1;
      continue;
    }

    const { error: insertError } = await supabase
      .from("announcements")
      .insert({
        church_id: churchId,
        title: "Birthday 🎉",
        content,
        is_published: true,
        published_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;
    createdCount += 1;
  }

  return {
    birthdayMembersCount: birthdayMembers.length,
    createdCount,
    skippedCount,
  };
}

export async function ensureBirthdayAnnouncements(churchId: string | null | undefined) {
  if (!churchId) {
    return { createdCount: 0, skippedCount: 0 };
  }

  logInfo("Birthday announcement automation running", { function: "ensureBirthdayAnnouncements", church_id: churchId });

  const { data, error } = await supabase.rpc("ensure_birthday_announcements" as never, {
    _church_id: churchId,
    _automation_date: getLocalDateString(),
  } as never);

  if (error) {
    if (isMissingRpc(error)) {
      logWarning("Birthday announcement RPC unavailable; using direct Supabase fallback.", {
        function: "ensureBirthdayAnnouncements",
        church_id: churchId,
        metadata: { error },
      });
      const fallback = await ensureBirthdayAnnouncementsFromClient(churchId);
      logInfo("Birthday announcement fallback completed.", {
        function: "ensureBirthdayAnnouncements",
        church_id: churchId,
        metadata: fallback,
      });
      return { createdCount: fallback.createdCount, skippedCount: fallback.skippedCount };
    }

    logWarning("Birthday announcement automation failed.", {
      function: "ensureBirthdayAnnouncements",
      church_id: churchId,
      metadata: { error },
    });
    return { createdCount: 0, skippedCount: 0 };
  }

  const result = data as BirthdayAnnouncementResult | null;
  const birthdayMembersCount = Number(result?.birthday_members_count ?? 0);
  const createdCount = Number(result?.created_count ?? 0);
  const skippedCount = Number(result?.skipped_count ?? 0);

  if (result && result.success === false) {
    logWarning("Birthday announcement automation skipped.", {
      function: "ensureBirthdayAnnouncements",
      church_id: churchId,
      metadata: { error: result.error },
    });
  }

  logInfo("Birthday announcement automation completed.", {
    function: "ensureBirthdayAnnouncements",
    church_id: churchId,
    metadata: { birthdayMembersCount, createdCount, skippedCount },
  });

  return { createdCount, skippedCount };
}
