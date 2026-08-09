import { supabase } from "@/integrations/supabase/client";

export type MemberAudioVerseTiming = {
  verse: number;
  text: string;
  start: number;
  end: number;
  duration: number;
  confidence: number;
};

export type ApprovedChapterAudio = {
  jobId: string;
  versionId: string;
  versionNumber: number;
  audioUrl: string;
  storagePath: string | null;
  downloaded: boolean;
  verses: MemberAudioVerseTiming[];
};

export async function getApprovedBibleChapterAudio(params: {
  churchId: string;
  bookName: string;
  abbreviation: string | null;
  chapter: number;
}): Promise<ApprovedChapterAudio | null> {
  const { data, error } = await supabase.functions.invoke("member-audio", {
    body: {
      churchId: params.churchId,
      book: params.bookName,
      abbreviation: params.abbreviation,
      chapter: params.chapter,
    },
  });

  if (error) throw error;
  return (data as { audio?: ApprovedChapterAudio | null } | null)?.audio ?? null;
}

export function findVerseAtTime(verses: MemberAudioVerseTiming[], time: number) {
  return verses.find((verse) => time >= verse.start && time <= verse.end)?.verse ?? null;
}

export function getVerseStartTime(verses: MemberAudioVerseTiming[], verseNumber: number) {
  return verses.find((verse) => verse.verse === verseNumber)?.start ?? null;
}
