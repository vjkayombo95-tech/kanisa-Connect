export type BibleReferenceBook = {
  id: string;
  book_number: number;
  name: string;
  abbreviation: string | null;
};

export type ParsedBibleReference =
  | {
      kind: "book";
      book: BibleReferenceBook;
    }
  | {
      kind: "chapter";
      book: BibleReferenceBook;
      chapter: number;
    }
  | {
      kind: "verse";
      book: BibleReferenceBook;
      chapter: number;
      startVerse: number;
      endVerse: number | null;
    };

const BOOK_NAME_ALIASES: Record<string, string[]> = {
  mwanzo: ["genesis", "mwa", "gn", "gen"],
  kutoka: ["exodus", "exo", "ex"],
  walawi: ["leviticus", "mambo ya walawi", "lev"],
  hesabu: ["numbers", "num", "hes"],
  "kumbukumbu la torati": ["deuteronomy", "kumbukumbu", "deut", "dt"],
  yoshua: ["joshua", "josh", "yos"],
  waamuzi: ["judges", "judg"],
  ruthu: ["ruth"],
  "1 samweli": ["1 samuel", "i samuel", "samueli wa kwanza", "1 sam"],
  "2 samweli": ["2 samuel", "ii samuel", "samueli wa pili", "2 sam"],
  "1 wafalme": ["1 kings", "i kings", "wafalme wa kwanza", "1 kgs"],
  "2 wafalme": ["2 kings", "ii kings", "wafalme wa pili", "2 kgs"],
  "1 nyakati": ["1 chronicles", "i chronicles", "mambo ya nyakati wa kwanza", "1 chr"],
  "2 nyakati": ["2 chronicles", "ii chronicles", "mambo ya nyakati wa pili", "2 chr"],
  ezra: ["ezr"],
  nehemia: ["nehemiah", "neh"],
  tobit: ["tobia", "tb", "tob"],
  judith: ["yudithi", "jdt", "jth"],
  esta: ["esther", "est"],
  "1 maccabees": ["1 mac", "1 macc", "i maccabees", "i mac", "1 wamakabayo"],
  "2 maccabees": ["2 mac", "2 macc", "ii maccabees", "ii mac", "2 wamakabayo"],
  ayubu: ["job"],
  zaburi: ["psalms", "psalm", "ps", "zb"],
  mithali: ["proverbs", "methali", "prov"],
  mhubiri: ["ecclesiastes", "eccl"],
  "wimbo ulio bora": ["song of songs", "song", "wimbo"],
  wisdom: ["wis", "hekima", "wisdom of solomon"],
  sirach: ["ecclesiasticus", "ecclus", "sir", "sira", "yoshua bin sira"],
  isaya: ["isaiah", "isa"],
  yeremia: ["jeremiah", "jer"],
  maombolezo: ["lamentations", "lam"],
  baruch: ["bar", "baruku"],
  ezekieli: ["ezekiel", "ezek"],
  danieli: ["daniel", "dan"],
  hosea: ["hos"],
  yoeli: ["joel"],
  amosi: ["amos", "amo"],
  obadia: ["obadiah", "obad"],
  yona: ["jonah", "jon"],
  mika: ["micah", "mic"],
  nahumu: ["nahum", "nah"],
  habakuki: ["habakkuk", "hab"],
  sefania: ["zephaniah", "zeph"],
  hagai: ["haggai", "hag"],
  zekaria: ["zechariah", "zech"],
  malaki: ["malachi", "mal"],
  mathayo: ["matthew", "mt", "matt", "mat"],
  marko: ["mark", "mk", "mrk"],
  luka: ["luke", "lk"],
  yohana: ["john", "jn", "jhn", "yn"],
  matendo: ["acts", "acts of the apostles", "mdo"],
  warumi: ["romans", "rom"],
  "1 wakorintho": ["1 corinthians", "i corinthians", "wakorintho wa kwanza", "1 cor"],
  "2 wakorintho": ["2 corinthians", "ii corinthians", "wakorintho wa pili", "2 cor"],
  wagalatia: ["galatians", "gal"],
  waefeso: ["ephesians", "eph"],
  wafilipi: ["philippians", "phil"],
  wakolosai: ["colossians", "col"],
  "1 wathesalonike": ["1 thessalonians", "i thessalonians", "wathesalonike wa kwanza", "1 thes"],
  "2 wathesalonike": ["2 thessalonians", "ii thessalonians", "wathesalonike wa pili", "2 thes"],
  "1 timotheo": ["1 timothy", "i timothy", "timotheo wa kwanza", "1 tim"],
  "2 timotheo": ["2 timothy", "ii timothy", "timotheo wa pili", "2 tim"],
  tito: ["titus"],
  filemoni: ["philemon", "filemon", "phlm"],
  waebrania: ["hebrews", "heb"],
  yakobo: ["james", "jas"],
  "1 petro": ["1 peter", "i peter", "petro wa kwanza", "1 pet"],
  "2 petro": ["2 peter", "ii peter", "petro wa pili", "2 pet"],
  "1 yohana": ["1 john", "i john", "yohana wa kwanza", "1 yn", "1 jn"],
  "2 yohana": ["2 john", "ii john", "yohana wa pili", "2 yn", "2 jn"],
  "3 yohana": ["3 john", "iii john", "yohana wa tatu", "3 yn", "3 jn"],
  yuda: ["jude"],
  ufunuo: ["revelation", "apocalypse", "rev", "uf"],
};

export function normalizeBibleLookup(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;()]/g, " ")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*[-\u2013\u2014]\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildBibleBookAliasMap(books: BibleReferenceBook[]) {
  const map = new Map<string, BibleReferenceBook>();

  books.forEach((book) => {
    [book.name, book.abbreviation].filter(Boolean).forEach((alias) => {
      map.set(normalizeBibleLookup(alias!), book);
    });

    BOOK_NAME_ALIASES[normalizeBibleLookup(book.name)]?.forEach((alias) => {
      map.set(normalizeBibleLookup(alias), book);
    });
  });

  return map;
}

export function getBibleBookAliases(book: BibleReferenceBook) {
  return Array.from(
    new Set([book.name, book.abbreviation, ...(BOOK_NAME_ALIASES[normalizeBibleLookup(book.name)] ?? [])].filter(Boolean) as string[]),
  );
}

function parsePositiveInteger(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseBibleReference(input: string, books: BibleReferenceBook[]): ParsedBibleReference | null {
  const query = normalizeBibleLookup(input);
  if (!query) return null;

  const aliases = buildBibleBookAliasMap(books);
  const directBook = aliases.get(query);
  if (directBook) return { kind: "book", book: directBook };

  const match = query.match(/^(.+?)\s+(\d+)(?::(\d*)?(?:-(?:(\d+):)?(\d*)?)?)?$/);
  if (!match) return null;

  const [, rawBookName, rawChapter, rawStartVerse, rawEndChapter, rawEndVerse] = match;
  const book = aliases.get(normalizeBibleLookup(rawBookName));
  const chapter = parsePositiveInteger(rawChapter);
  if (!book || !chapter) return null;

  const startVerse = parsePositiveInteger(rawStartVerse);
  if (!startVerse) return { kind: "chapter", book, chapter };

  const endChapter = parsePositiveInteger(rawEndChapter);
  const endVerse = parsePositiveInteger(rawEndVerse);

  return {
    kind: "verse",
    book,
    chapter,
    startVerse,
    endVerse: endChapter && endChapter !== chapter ? null : endVerse,
  };
}

export function looksLikeBibleReference(input: string) {
  const query = normalizeBibleLookup(input);
  if (!query) return false;

  return /\b([1-3]\s*)?[\p{L}.]+\s+\d+(?::\d+)?(?:[-,]\d+)?\b/iu.test(query);
}

export function bibleReferenceToPath(reference: ParsedBibleReference) {
  if (reference.kind === "book") return `/portal/bible/${reference.book.id}`;
  if (reference.kind === "chapter") return `/portal/bible/${reference.book.id}/chapter/${reference.chapter}`;

  const params = new URLSearchParams({ startVerse: String(reference.startVerse) });
  if (reference.endVerse && reference.endVerse !== reference.startVerse) {
    params.set("endVerse", String(reference.endVerse));
  }

  return `/portal/bible/${reference.book.id}/chapter/${reference.chapter}?${params.toString()}`;
}
