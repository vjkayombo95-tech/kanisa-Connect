const LITURGICAL_DISPLAY_KEYS: Record<string, string> = {
  ordinary_time: "member_portal.catholic_content.ordinary_time",
  advent: "member_portal.catholic_content.advent",
  christmas: "member_portal.catholic_content.christmas",
  lent: "member_portal.catholic_content.lent",
  easter: "member_portal.catholic_content.easter",
  solemnity: "member_portal.catholic_content.solemnity",
  feast: "member_portal.catholic_content.feast",
  memorial: "member_portal.catholic_content.memorial",
  optional_memorial: "member_portal.catholic_content.optional_memorial",
};

export function getLiturgicalDisplayKey(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return LITURGICAL_DISPLAY_KEYS[normalized] ?? null;
}

