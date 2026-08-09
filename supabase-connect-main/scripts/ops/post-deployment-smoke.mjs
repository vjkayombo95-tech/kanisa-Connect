#!/usr/bin/env node

const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SMOKE_ACCESS_TOKEN", "SMOKE_CHURCH_ID"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const config = {
  supabaseUrl: process.env.SUPABASE_URL.replace(/\/$/, ""),
  anonKey: process.env.SUPABASE_ANON_KEY,
  accessToken: process.env.SMOKE_ACCESS_TOKEN,
  churchId: process.env.SMOKE_CHURCH_ID,
  memberAccessToken: process.env.SMOKE_MEMBER_ACCESS_TOKEN || process.env.SMOKE_ACCESS_TOKEN,
  book: process.env.SMOKE_BOOK || "Genesis",
  abbreviation: process.env.SMOKE_ABBREVIATION || "Gen",
  chapter: Number(process.env.SMOKE_CHAPTER || 1),
  uploadJobId: process.env.SMOKE_UPLOAD_JOB_ID,
  reviewId: process.env.SMOKE_REVIEW_ID,
  versionId: process.env.SMOKE_VERSION_ID,
  mutate: process.env.SMOKE_MUTATE === "true",
};

const results = [];

function record(name, status, detail = "") {
  results.push({ name, status, detail });
  const marker = status === "pass" ? "PASS" : status === "skip" ? "SKIP" : "FAIL";
  console.log(`[${marker}] ${name}${detail ? ` - ${detail}` : ""}`);
}

async function invokeFunction(name, body, token = config.accessToken) {
  const response = await fetch(`${config.supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: config.anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${name} returned ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function restSelect(table, query) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      apikey: config.anonKey,
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${table} select returned ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function runStep(name, fn) {
  try {
    const detail = await fn();
    record(name, "pass", detail);
  } catch (error) {
    record(name, "fail", error.message);
  }
}

await runStep("operations health", async () => {
  const data = await invokeFunction("operations-health", { churchId: config.churchId });
  const databaseStatus = data?.health?.database?.status || "unknown";
  const storageStatus = data?.health?.storage?.status || "unknown";
  return `database=${databaseStatus}, storage=${storageStatus}`;
});

await runStep("operations metrics", async () => {
  const data = await invokeFunction("operations-metrics", { churchId: config.churchId });
  const metrics = data?.metrics || {};
  return `queue=${metrics.queueDepth ?? 0}, failed=${metrics.failedJobs ?? 0}, published=${metrics.publishedAudioCount ?? 0}`;
});

await runStep("queue visibility", async () => {
  const data = await invokeFunction("operations-metrics", { churchId: config.churchId });
  if (typeof data?.metrics?.queueDepth !== "number") throw new Error("queueDepth missing");
  return `queueDepth=${data.metrics.queueDepth}`;
});

await runStep("worker heartbeat visibility", async () => {
  const data = await invokeFunction("operations-health", { churchId: config.churchId });
  const worker = data?.health?.worker || data?.health?.metrics?.workerStatus || {};
  const python = data?.health?.pythonWorker || data?.health?.metrics?.pythonWorkerStatus || {};
  return `worker=${worker.health || worker.status || "missing"}, python=${python.health || python.status || "missing"}`;
});

await runStep("member playback", async () => {
  const data = await invokeFunction(
    "member-audio",
    {
      churchId: config.churchId,
      book: config.book,
      abbreviation: config.abbreviation,
      chapter: config.chapter,
    },
    config.memberAccessToken,
  );
  return data?.audio ? `audio version=${data.audio.versionId}` : "no published audio returned";
});

if (config.uploadJobId) {
  await runStep("upload verification", async () => {
    const data = await invokeFunction("audio-cms", {
      action: "create_upload_url",
      churchId: config.churchId,
      jobId: config.uploadJobId,
      bucket: "audio",
      fileName: "smoke-upload-check.mp3",
    });
    return data?.signedUrl ? `signed upload path=${data.path}` : "signed upload response received";
  });
} else if (config.mutate) {
  await runStep("upload verification", async () => {
    const data = await invokeFunction("audio-cms", {
      action: "create_job",
      churchId: config.churchId,
      contentType: "bible",
      book: `${config.book} Smoke`,
      chapter: config.chapter,
    });
    return `created smoke job=${data?.job?.id || data?.id || "unknown"}`;
  });
} else {
  record("upload verification", "skip", "set SMOKE_UPLOAD_JOB_ID or SMOKE_MUTATE=true with a disposable church");
}

if (config.reviewId) {
  await runStep("review verification", async () => {
    const rows = await restSelect(
      "audio_reviews",
      `select=id,status,job_id&church_id=eq.${encodeURIComponent(config.churchId)}&id=eq.${encodeURIComponent(config.reviewId)}&limit=1`,
    );
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("seeded review not found");
    return `review=${rows[0].id}, status=${rows[0].status}`;
  });
} else {
  record("review verification", "skip", "set SMOKE_REVIEW_ID for seeded review verification");
}

if (config.versionId) {
  await runStep("publish verification", async () => {
    const rows = await restSelect(
      "audio_versions",
      `select=id,status,job_id,published_at&church_id=eq.${encodeURIComponent(config.churchId)}&id=eq.${encodeURIComponent(config.versionId)}&limit=1`,
    );
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("seeded version not found");
    return `version=${rows[0].id}, status=${rows[0].status}`;
  });
} else {
  record("publish verification", "skip", "set SMOKE_VERSION_ID for seeded publish verification");
}

const failed = results.filter((result) => result.status === "fail");
if (failed.length) {
  console.error(`Smoke test failed: ${failed.length} failing check(s).`);
  process.exit(1);
}

console.log("Post-deployment smoke checks completed.");
