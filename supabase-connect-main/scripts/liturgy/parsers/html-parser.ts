import type { RawReading } from "../models/daily-reading.ts";

type ReadingSectionName = "Reading I" | "Responsorial Psalm" | "Reading II" | "Alleluia" | "Gospel";

type ReadingSections = Partial<Record<ReadingSectionName, string[]>>;

export function parseReadingHtml(html: string, date: Date): RawReading {
  const isoDate = date.toISOString().slice(0, 10);
  const text = htmlToText(html);
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sections = collectReadingSections(lines);
  const firstReadingReference = getSectionReference(sections["Reading I"]);
  const responsorialPsalmReference = getSectionReference(sections["Responsorial Psalm"]);
  const secondReadingReference = getOptionalSectionReference(sections["Reading II"]);
  const gospelReference = getSectionReference(sections.Gospel);

  if (!firstReadingReference || !responsorialPsalmReference || !gospelReference) {
    throw new Error("Unexpected USCCB page layout: required reading references were not found.");
  }

  return {
    date: isoDate,
    celebration: extractCelebration(html, lines),
    liturgicalSeason: "",
    liturgicalWeek: "",
    liturgicalYear: "A",
    weekdayCycle: "I",
    liturgicalColor: "green",
    rank: "weekday",
    holyDayOfObligation: false,
    saint: null,
    firstReadingReference,
    responsorialPsalmReference,
    psalmResponse: extractPsalmResponse(sections["Responsorial Psalm"]),
    secondReadingReference,
    gospelAcclamation: extractGospelAcclamation(sections.Alleluia),
    gospelReference,
    lectionaryNumber: extractLectionaryNumber(lines),
    notes: null,
  };
}

function collectReadingSections(lines: string[]): ReadingSections {
  const sections: ReadingSections = {};
  const headingNames: ReadingSectionName[] = ["Reading I", "Responsorial Psalm", "Reading II", "Alleluia", "Gospel"];
  let currentHeading: ReadingSectionName | null = null;

  for (const line of lines) {
    const heading = headingNames.find((item) => item.toLowerCase() === line.toLowerCase());
    if (heading) {
      currentHeading = heading;
      sections[currentHeading] = [];
      continue;
    }

    if (currentHeading) {
      sections[currentHeading]?.push(line);
    }
  }

  return sections;
}

function getSectionReference(lines: string[] | undefined): string {
  return getOptionalSectionReference(lines) ?? "";
}

function getOptionalSectionReference(lines: string[] | undefined): string | null {
  const referenceLine = lines?.find((line) => looksLikeReferenceLine(line));
  if (!referenceLine) return null;
  return stripInlineResponse(referenceLine);
}

function looksLikeReferenceLine(line: string): boolean {
  return /^[1-3]?\s?[A-Z][A-Za-z .]+(?:\s\d|\s[IVX]+:)/.test(line) && /[\d:]/.test(line);
}

function stripInlineResponse(line: string): string {
  return line.replace(/\s+R\.\s.*$/u, "").trim();
}

function extractPsalmResponse(lines: string[] | undefined): string {
  const responseLine = lines?.find((line) => /\bR\.\s+/u.test(line));
  if (!responseLine) return "";
  const response = responseLine.match(/\bR\.\s*(.+)$/u)?.[1]?.trim() ?? "";
  return response.replace(/^\([^)]+\)\s*/u, "");
}

function extractGospelAcclamation(lines: string[] | undefined): string | null {
  const responseLine = lines?.find((line) => /\bR\.\s+/u.test(line));
  const response = responseLine?.match(/\bR\.\s*(.+)$/u)?.[1]?.trim();
  return response || null;
}

function extractLectionaryNumber(lines: string[]): string {
  const lectionaryLine = lines.find((line) => /^Lectionary:/i.test(line));
  return lectionaryLine?.replace(/^Lectionary:\s*/i, "").trim() ?? "";
}

function extractCelebration(html: string, lines: string[]): string {
  const heading = extractFirstContentHeading(html);
  if (heading) return heading;

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) return decodeHtmlEntities(stripTags(title).split("|")[0]?.trim() ?? "");

  const lectionaryIndex = lines.findIndex((line) => /^Lectionary:/i.test(line));
  for (let index = lectionaryIndex - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line && !isNavigationLine(line)) return line;
  }

  throw new Error("Unexpected USCCB page layout: celebration heading was not found.");
}

function extractFirstContentHeading(html: string): string | null {
  const headingMatches = html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);

  for (const match of headingMatches) {
    const heading = decodeHtmlEntities(stripTags(match[1]).trim());
    if (heading && !isNavigationLine(heading)) return heading;
  }

  return null;
}

function isNavigationLine(line: string): boolean {
  return /^(Menu:|Main navigation|Daily Readings|Get the Daily Readings|Dive into God's Word|About USCCB|Topics|Prayer & Worship)/i.test(
    line,
  );
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n"),
  );
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };

  return value
    .replace(/&([a-z]+);/gi, (entity, name: string) => namedEntities[name.toLowerCase()] ?? entity)
    .replace(/&#(\d+);/g, (_entity, codepoint: string) => String.fromCodePoint(Number(codepoint)))
    .replace(/&#x([0-9a-f]+);/gi, (_entity, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}
