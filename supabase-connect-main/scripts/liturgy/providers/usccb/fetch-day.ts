export type FetchDayResult = {
  url: string;
  html: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function buildUSCCBReadingUrl(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);
  return `https://bible.usccb.org/bible/readings/${month}${day}${year}.cfm`;
}

export async function fetchDayHtml(date: Date, fetcher: FetchLike = fetch): Promise<FetchDayResult> {
  const url = buildUSCCBReadingUrl(date);

  let response: Response;
  try {
    response = await fetcher(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to download USCCB daily reading page from ${url}: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`USCCB daily reading request failed for ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  if (!html.trim()) {
    throw new Error(`USCCB daily reading page was empty: ${url}`);
  }

  return { url, html };
}
