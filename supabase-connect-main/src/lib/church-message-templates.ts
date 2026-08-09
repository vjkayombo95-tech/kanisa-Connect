import { supabase } from "@/integrations/supabase/client";
import { logWarning } from "@/lib/error-logger";

export type ChurchMessageTemplateType =
  | "birthday_wish"
  | "wedding_anniversary"
  | "wedding_anniversary_wish"
  | "service_recognition"
  | "contribution_appreciation";

export type ChurchMessageTemplate = {
  id?: string;
  church_id: string | null;
  template_type: ChurchMessageTemplateType;
  title: string;
  body: string;
  default_bible_verse: string | null;
  is_active: boolean;
};

export const birthdayBibleVerseOptions = [
  { reference: "Yeremia 29:11", text: "Maana nayajua mawazo ninayowawazia ninyi, asema Bwana, ni mawazo ya amani wala si ya mabaya." },
  { reference: "Zaburi 118:24", text: "Siku hii ndiyo aliyoifanya Bwana; tutashangilia na kuifurahia." },
  { reference: "Hesabu 6:24-26", text: "Bwana akubariki na kukulinda; Bwana akuangazie nuru za uso wake, na kukufadhili." },
  { reference: "Zaburi 20:4", text: "Akupe sawasawa na haja ya moyo wako, na kuyatimiza mashauri yako yote." },
  { reference: "Mithali 9:11", text: "Maana kwa msaada wangu siku zako zitaongezeka, na miaka ya maisha yako itaongezwa." },
];

export const weddingAnniversaryBibleVerseOptions = [
  { reference: "Marko 10:9", text: "Basi aliowaunganisha Mungu, mwanadamu asiwatenganishe." },
  { reference: "1 Wakorintho 13:4-7", text: "Upendo huvumilia, hufadhili; upendo hauhusudu; upendo hautakabari." },
  { reference: "Mhubiri 4:9-10", text: "Afadhali kuwa wawili kuliko mmoja; maana wapata ijara njema kwa kazi yao." },
  { reference: "Wakolosai 3:14", text: "Zaidi ya hayo yote jivikeni upendo, ndio kifungo cha ukamilifu." },
  { reference: "Mwanzo 2:24", text: "Kwa hiyo mwanamume atamwacha baba yake na mama yake, naye ataambatana na mkewe." },
];

export const defaultBirthdayTemplate = `Kanisa la {church_name} tunakutakia sikukuu njema ya kuzaliwa, ndugu {member_name}.

Tunamshukuru Mungu kwa maisha yako na tunakuombea baraka, afya, furaha na amani katika mwaka huu mpya wa maisha yako.

Mstari wa kutafakari:
"{bible_verse}"

Ubarikiwe sana.
- {church_name}`;

export const defaultTemplateBodies: Record<ChurchMessageTemplateType, { title: string; body: string; verse: string | null }> = {
  birthday_wish: {
    title: "Birthday Wish",
    body: defaultBirthdayTemplate,
    verse: "Yeremia 29:11",
  },
  wedding_anniversary_wish: {
    title: "Wedding Anniversary Wish",
    body: `Kanisa la {church_name} linawatakia heri ya kumbukumbu ya ndoa, ndugu {member_name}.

Tunamshukuru Mungu kwa safari yenu ya upendo na tunawaombea umoja, amani na baraka zaidi.

Mstari wa kutafakari:
"{bible_verse}"

Mungu aendelee kuibariki familia yenu.
- {church_name}`,
    verse: "Hesabu 6:24-26",
  },
  wedding_anniversary: {
    title: "Wedding Anniversary Wish",
    body: `Kanisa la {church_name} linawatakia heri ya kumbukumbu ya ndoa, ndugu {member_name} na {spouse_name}.

Tunamshukuru Mungu kwa safari yenu ya ndoa na tunawaombea upendo, umoja, uvumilivu, amani na baraka zaidi katika familia yenu.

Mstari wa kutafakari:
"{bible_verse}"

Mungu aendelee kuibariki ndoa yenu.
— {church_name}`,
    verse: "Marko 10:9",
  },
  service_recognition: {
    title: "Service Recognition",
    body: `Kanisa la {church_name} linakushukuru, ndugu {member_name}, kwa huduma yako ya uaminifu.

Tunathamini moyo wako wa kujitoa na tunakuombea nguvu, hekima na furaha katika huduma.

Ubarikiwe sana.
- {church_name}`,
    verse: null,
  },
  contribution_appreciation: {
    title: "Contribution Appreciation",
    body: `Kanisa la {church_name} linakushukuru, ndugu {member_name}, kwa moyo wako wa ukarimu.

Mchango wako unasaidia kazi ya huduma na kujenga jamii ya imani.

Mungu akubariki sana.
- {church_name}`,
    verse: null,
  },
};

export function getBibleVerseText(reference: string | null | undefined) {
  if (!reference) return "";
  const verse = [...birthdayBibleVerseOptions, ...weddingAnniversaryBibleVerseOptions].find((option) => option.reference === reference);
  return verse ? `${verse.reference}: ${verse.text}` : reference;
}

export function getDefaultTemplate(type: ChurchMessageTemplateType, churchId: string | null): ChurchMessageTemplate {
  const template = defaultTemplateBodies[type];
  return {
    church_id: churchId,
    template_type: type,
    title: template.title,
    body: template.body,
    default_bible_verse: template.verse,
    is_active: true,
  };
}

export function renderChurchMessageTemplate(
  template: Pick<ChurchMessageTemplate, "body" | "default_bible_verse">,
  values: {
    church_name?: string | null;
    member_name?: string | null;
    spouse_name?: string | null;
    date?: string | null;
    community_name?: string | null;
    bible_verse?: string | null;
  },
) {
  const memberName = values.member_name?.trim() || "ndugu";
  const firstName = memberName.split(/\s+/)[0] || memberName;
  const spouseName = values.spouse_name?.trim() || "mwenza wako";
  const bibleVerse = values.bible_verse || getBibleVerseText(template.default_bible_verse);

  return template.body
    .replaceAll("{church_name}", values.church_name?.trim() || "kanisa")
    .replaceAll("{member_name}", memberName)
    .replaceAll("{spouse_name}", spouseName)
    .replaceAll("{first_name}", firstName)
    .replaceAll("{date}", values.date?.trim() || new Date().toLocaleDateString("en-TZ"))
    .replaceAll("{bible_verse}", bibleVerse)
    .replaceAll("{community_name}", values.community_name?.trim() || "jumuiya");
}

export async function fetchChurchMessageTemplate(
  churchId: string | null | undefined,
  templateType: ChurchMessageTemplateType,
) {
  const fallback = getDefaultTemplate(templateType, churchId ?? null);
  if (!churchId) return fallback;

  const { data, error } = await supabase
    .from("message_templates" as never)
    .select("id, church_id, template_type, title, body, default_bible_verse, is_active")
    .eq("church_id", churchId)
    .eq("template_type", templateType)
    .maybeSingle();

  if (error) {
    logWarning("Message template lookup failed; using default template.", {
      function: "fetchChurchMessageTemplate",
      church_id: churchId,
      metadata: { templateType, error },
    });
    return fallback;
  }

  if (data) return data as ChurchMessageTemplate;

  if (templateType === "wedding_anniversary") {
    const { data: legacyData, error: legacyError } = await supabase
      .from("message_templates" as never)
      .select("id, church_id, template_type, title, body, default_bible_verse, is_active")
      .eq("church_id", churchId)
      .eq("template_type", "wedding_anniversary_wish")
      .maybeSingle();

    if (!legacyError && legacyData) {
      return { ...(legacyData as ChurchMessageTemplate), template_type: "wedding_anniversary" };
    }
  }

  return fallback;
}

export async function saveChurchMessageTemplate(template: ChurchMessageTemplate) {
  if (!template.church_id) throw new Error("Church is required.");

  const existing = template.id
    ? { id: template.id }
    : await supabase
        .from("message_templates" as never)
        .select("id")
        .eq("church_id", template.church_id)
        .eq("template_type", template.template_type)
        .maybeSingle();

  const payload = {
    church_id: template.church_id,
    template_type: template.template_type,
    title: template.title.trim(),
    body: template.body.trim(),
    content: template.body.trim(),
    type: template.template_type,
    category: "personal_message",
    default_bible_verse: template.default_bible_verse,
    is_active: template.is_active,
    updated_at: new Date().toISOString(),
  };

  if ("data" in existing && existing.data?.id) {
    const { error } = await supabase.from("message_templates" as never).update(payload as never).eq("id", existing.data.id);
    if (error) throw error;
    return;
  }

  if ("id" in existing && existing.id) {
    const { error } = await supabase.from("message_templates" as never).update(payload as never).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("message_templates" as never).insert(payload as never);
  if (error) throw error;
}
