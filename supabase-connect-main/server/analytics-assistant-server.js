import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const PORT = Number(process.env.PORT || 8787);
const ENV_FILENAMES = [".env.local", ".env"];

const MOCK_CONTRIBUTIONS = [
  { member: "Maria John", amount: 120000, category: "tithe", created_at: "2026-04-02T00:00:00Z" },
  { member: "Joseph Peter", amount: 85000, category: "offering", created_at: "2026-04-03T00:00:00Z" },
  { member: "Anna James", amount: 200000, category: "building", created_at: "2026-04-04T00:00:00Z" },
  { member: "David Paulo", amount: 65000, category: "missions", created_at: "2026-04-05T00:00:00Z" },
  { member: "Grace Neema", amount: 175000, category: "tithe", created_at: "2026-04-05T00:00:00Z" },
  { member: "Maria John", amount: 90000, category: "offering", created_at: "2026-03-08T00:00:00Z" },
  { member: "Joseph Peter", amount: 110000, category: "tithe", created_at: "2026-03-10T00:00:00Z" },
  { member: "Anna James", amount: 130000, category: "building", created_at: "2026-03-16T00:00:00Z" },
  { member: "Samuel Elias", amount: 95000, category: "youth", created_at: "2026-03-18T00:00:00Z" },
  { member: "Grace Neema", amount: 150000, category: "missions", created_at: "2026-03-21T00:00:00Z" },
];

const BASE_DATE = new Date();

function loadLocalEnv() {
  for (const filename of ENV_FILENAMES) {
    const filePath = join(process.cwd(), filename);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadLocalEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function shiftMonth(date, diff) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + diff, 1));
}

function parseIntent(query) {
  const lower = query.toLowerCase();

  let type = "summary_report";
  if (lower.includes("top") || lower.includes("contributor")) type = "top_contributors";
  else if (lower.includes("monthly") || lower.includes("month") || lower.includes("report")) type = "monthly_report";
  else if (lower.includes("category") || lower.includes("breakdown")) type = "category_breakdown";

  let dateRange = "all_time";
  if (lower.includes("this month") || lower.includes("current month") || lower.includes("monthly report")) {
    dateRange = "current_month";
  } else if (lower.includes("last month") || lower.includes("previous month")) {
    dateRange = "last_month";
  } else if (lower.includes("year") || lower.includes("ytd")) {
    dateRange = "year_to_date";
  }

  let category = "all";
  if (lower.includes("tithe")) category = "tithe";
  else if (lower.includes("offering")) category = "offering";
  else if (lower.includes("building")) category = "building";
  else if (lower.includes("mission")) category = "missions";
  else if (lower.includes("youth")) category = "youth";

  return { type, dateRange, category };
}

function getRangeBounds(dateRange) {
  const currentMonthStart = startOfMonth(BASE_DATE);
  const nextMonthStart = shiftMonth(BASE_DATE, 1);
  const lastMonthStart = shiftMonth(BASE_DATE, -1);
  const yearStart = new Date(Date.UTC(BASE_DATE.getUTCFullYear(), 0, 1));

  if (dateRange === "current_month") {
    return { start: currentMonthStart, end: nextMonthStart };
  }

  if (dateRange === "last_month") {
    return { start: lastMonthStart, end: currentMonthStart };
  }

  if (dateRange === "year_to_date") {
    return { start: yearStart, end: new Date(BASE_DATE.getTime() + 24 * 60 * 60 * 1000) };
  }

  return null;
}

function filterMockData(data, intent) {
  const bounds = getRangeBounds(intent.dateRange);

  return data.filter((entry) => {
    const createdAt = new Date(entry.created_at);
    const inRange = bounds ? createdAt >= bounds.start && createdAt < bounds.end : true;
    const inCategory = intent.category === "all" ? true : entry.category === intent.category;
    return inRange && inCategory;
  });
}

function getPreviousRange(dateRange) {
  if (dateRange === "current_month") return "last_month";
  return null;
}

function aggregateRows(filteredRows) {
  const totalGiving = filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const contributorTotals = filteredRows.reduce((accumulator, row) => {
    const name = row.memberName || row.donor_name || "Anonymous";
    accumulator[name] = (accumulator[name] || 0) + Number(row.amount || 0);
    return accumulator;
  }, {});

  const categoryTotals = filteredRows.reduce((accumulator, row) => {
    const category = row.categoryName || "Uncategorized";
    accumulator[category] = (accumulator[category] || 0) + Number(row.amount || 0);
    return accumulator;
  }, {});

  const topContributors = Object.entries(contributorTotals)
    .map(([name, total]) => ({
      name,
      total,
      percentage: totalGiving > 0 ? (total / totalGiving) * 100 : 0,
    }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 5);

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([category, total]) => ({
      category,
      total,
      percentage: totalGiving > 0 ? (total / totalGiving) * 100 : 0,
    }))
    .sort((left, right) => right.total - left.total);

  return {
    summary: {
      totalGiving,
      contributorCount: Object.keys(contributorTotals).length,
      averageGift: filteredRows.length > 0 ? totalGiving / filteredRows.length : 0,
    },
    topContributors,
    categoryBreakdown,
  };
}

function buildInsights(filteredRows, previousRows, summary, topContributors, categoryBreakdown) {
  const insights = [];
  const previousTotal = previousRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  if (previousTotal > 0) {
    const delta = ((summary.totalGiving - previousTotal) / previousTotal) * 100;
    const direction = delta >= 0 ? "increased" : "decreased";
    insights.push(`Giving ${direction} by ${Math.abs(delta).toFixed(1)}% compared with the previous period.`);
  }

  const topFiveTotal = topContributors.slice(0, 5).reduce((sum, entry) => sum + entry.total, 0);
  if (summary.totalGiving > 0) {
    insights.push(`Top 5 members contribute ${((topFiveTotal / summary.totalGiving) * 100).toFixed(1)}% of giving.`);
  }

  if (categoryBreakdown[0]) {
    insights.push(`${categoryBreakdown[0].category} is the leading category at ${categoryBreakdown[0].percentage.toFixed(1)}% of giving.`);
  }

  if (filteredRows.length > 0) {
    const busiestDay = filteredRows.reduce((accumulator, row) => {
      const key = row.created_at?.slice(0, 10) || "Unknown date";
      accumulator[key] = (accumulator[key] || 0) + Number(row.amount || 0);
      return accumulator;
    }, {});

    const [topDate, topDateTotal] = Object.entries(busiestDay).sort((left, right) => right[1] - left[1])[0];
    insights.push(`The strongest giving day in this dataset was ${topDate} with TZS ${Number(topDateTotal).toLocaleString()}.`);
  }

  return insights;
}

function getRelationRecord(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  if (value && typeof value === "object") {
    return value;
  }

  return null;
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const plainError = error;
    const segments = [plainError.message, plainError.details, plainError.hint]
      .filter((segment) => typeof segment === "string" && segment.trim().length > 0)
      .map((segment) => segment.trim());

    if (segments.length > 0) {
      return segments.join(" | ");
    }
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return "Unknown live analytics error.";
}

async function fetchSupabaseRows({ churchId, accessToken, intent }) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const bounds = getRangeBounds(intent.dateRange);
  // Supabase analytics queries must use contributions.created_at because some projects no longer expose a date column.
  let query = client
    .from("contributions")
    .select(
      "amount, created_at, donor_name, church_id, members!contributions_member_id_fkey(full_name), contribution_categories!contributions_category_id_fkey(name)",
    )
    .eq("church_id", churchId)
    .order("created_at", { ascending: false });

  if (bounds) {
    query = query.gte("created_at", bounds.start.toISOString()).lt("created_at", bounds.end.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  const normalized = (data || []).map((row) => ({
    amount: Number(row.amount || 0),
    created_at: row.created_at || "",
    donor_name: row.donor_name || null,
    memberName: getRelationRecord(row.members)?.full_name || null,
    categoryName: getRelationRecord(row.contribution_categories)?.name || "Uncategorized",
  }));

  return intent.category === "all"
    ? normalized
    : normalized.filter((row) => row.categoryName.toLowerCase().includes(intent.category.replaceAll("_", " ")));
}

async function buildSupabaseReport({ query, churchId, accessToken }) {
  const intent = parseIntent(query);
  const filteredRows = await fetchSupabaseRows({ churchId, accessToken, intent });
  const previousRange = getPreviousRange(intent.dateRange);
  const previousRows = previousRange
    ? await fetchSupabaseRows({ churchId, accessToken, intent: { ...intent, dateRange: previousRange } })
    : [];

  const { summary, topContributors, categoryBreakdown } = aggregateRows(filteredRows);

  return {
    query,
    intent,
    summary,
    topContributors,
    categoryBreakdown,
    insights: buildInsights(filteredRows, previousRows, summary, topContributors, categoryBreakdown),
    generatedAt: new Date().toISOString(),
    source: "supabase",
  };
}

function buildMockReport(query, options = {}) {
  const intent = parseIntent(query);
  const filteredRows = filterMockData(MOCK_CONTRIBUTIONS, intent).map((entry) => ({
    amount: entry.amount,
    created_at: entry.created_at,
    donor_name: entry.member,
    memberName: entry.member,
    categoryName: entry.category,
  }));
  const previousRange = getPreviousRange(intent.dateRange);
  const previousRows = previousRange
    ? filterMockData(MOCK_CONTRIBUTIONS, { ...intent, dateRange: previousRange }).map((entry) => ({
        amount: entry.amount,
        created_at: entry.created_at,
        donor_name: entry.member,
        memberName: entry.member,
        categoryName: entry.category,
      }))
    : [];

  const { summary, topContributors, categoryBreakdown } = aggregateRows(filteredRows);

  return {
    query,
    intent,
    summary,
    topContributors,
    categoryBreakdown,
    insights: buildInsights(filteredRows, previousRows, summary, topContributors, categoryBreakdown),
    generatedAt: new Date().toISOString(),
    source: "mock",
    warning: options.warning || null,
  };
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/api/analytics-assistant/health") {
    sendJson(response, 200, { ok: true, service: "analytics-assistant", supabase: hasSupabaseConfig });
    return;
  }

  if (request.method === "POST" && request.url === "/api/analytics-assistant/query") {
    try {
      const body = await parseBody(request);
      const query = typeof body.query === "string" ? body.query.trim() : "";
      const churchId = typeof body.churchId === "string" ? body.churchId.trim() : "";
      const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";

      if (!query) {
        sendJson(response, 400, { error: "Please provide a query." });
        return;
      }

      if (!churchId || !accessToken) {
        sendJson(response, 400, { error: "Church context and access token are required." });
        return;
      }

      if (hasSupabaseConfig) {
        try {
          const liveReport = await buildSupabaseReport({ query, churchId, accessToken });
          sendJson(response, 200, liveReport);
        } catch (liveError) {
          const liveErrorMessage = getErrorMessage(liveError);
          console.error("Analytics assistant live query failed, using mock fallback:", {
            churchId,
            message: liveErrorMessage,
            error: liveError,
          });
          sendJson(
            response,
            200,
            buildMockReport(query, {
              warning: `Live analytics is temporarily unavailable: ${liveErrorMessage}`,
            }),
          );
        }
        return;
      }

      sendJson(response, 200, buildMockReport(query));
      return;
    } catch (error) {
      console.error("Analytics assistant query failed:", error);
      sendJson(response, 500, { error: error instanceof Error ? error.message : "Analytics assistant failed." });
      return;
    }
  }

  sendJson(response, 404, { error: "Not found." });
});

server.listen(PORT, () => {
  console.log(`Analytics assistant server listening on http://localhost:${PORT}`);
});
