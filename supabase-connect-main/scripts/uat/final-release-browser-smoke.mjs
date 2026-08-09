import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseUrl = process.env.UAT_BASE_URL || "http://127.0.0.1:4174";
const credentialsPath = new URL("../../evaluation/uat/.uat-credentials.local.json", import.meta.url);
const credentials = JSON.parse(await readFile(credentialsPath, "utf8"));

const personas = [
  {
    name: "Member",
    email: "uat.member@kanisaconnect.test",
    expectedPath: "/portal",
    expectedGroups: [],
  },
  {
    name: "Pastor + Church Admin",
    email: "uat.admin-pastor@kanisaconnect.test",
    expectedPath: "/church-admin",
    expectedGroups: ["finance", "operations"],
    expectedGroupItems: {
      operations: ["calendar", "events", "event-requests", "announcements", "sermons", "reports", "finance-summary"],
    },
  },
];

function requirePassword(email) {
  const password = credentials.accounts?.[email];
  if (typeof password !== "string" || password.length === 0) {
    throw new Error(`Missing local UAT credential for ${email}`);
  }
  return password;
}

async function waitForWorkspace(page, expectedPath) {
  await page.waitForURL((url) => url.pathname.startsWith(expectedPath), { timeout: 30_000 });
  await page.getByTestId("workspace-account-menu-trigger").waitFor({ state: "visible", timeout: 45_000 });
  if (new URL(page.url()).pathname.includes("onboarding")) {
    throw new Error("Authenticated persona was redirected to onboarding");
  }
}

async function waitForStableNavigation(page, expectedGroups, expectedGroupItems = {}) {
  await page.waitForFunction(
    ({ groupIds, itemIdsByGroup, stableForMs }) => {
      const groups = [...document.querySelectorAll("[data-navigation-group-id]")];
      const snapshot = groups.map((group) => ({
        id: group.getAttribute("data-navigation-group-id"),
        items: [...group.querySelectorAll("[data-navigation-item-id]")]
          .map((item) => item.getAttribute("data-navigation-item-id")),
      }));
      const signature = JSON.stringify(snapshot);
      const previous = window.__workspaceNavigationSmokeReadiness;
      const now = performance.now();

      if (!previous || previous.signature !== signature) {
        window.__workspaceNavigationSmokeReadiness = { signature, stableSince: now };
        return false;
      }

      const renderedGroupIds = snapshot.map((group) => group.id);
      const groupsAreUnique = new Set(renderedGroupIds).size === renderedGroupIds.length;
      const expectedGroupsExistOnce = groupIds.every(
        (groupId) => renderedGroupIds.filter((renderedId) => renderedId === groupId).length === 1,
      );
      const expectedItemsExistOnce = Object.entries(itemIdsByGroup).every(([groupId, itemIds]) => {
        const group = snapshot.find((candidate) => candidate.id === groupId);
        return group && itemIds.every(
          (itemId) => group.items.filter((renderedId) => renderedId === itemId).length === 1,
        );
      });

      return snapshot.length > 0
        && groupsAreUnique
        && expectedGroupsExistOnce
        && expectedItemsExistOnce
        && now - previous.stableSince >= stableForMs;
    },
    { groupIds: expectedGroups, itemIdsByGroup: expectedGroupItems, stableForMs: 1_000 },
    { timeout: 45_000, polling: 100 },
  );
}

const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const persona of personas) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const startedAt = Date.now();
    const authResponses = [];
    const browserErrors = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/auth/v1/")) authResponses.push(`${response.status()} ${url.pathname}`);
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    try {
      await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
      await page.getByTestId("login-identity").fill(persona.email);
      await page.getByTestId("login-password").fill(requirePassword(persona.email));
      await page.getByTestId("login-submit").click();
      await waitForWorkspace(page, persona.expectedPath);
      await waitForStableNavigation(page, persona.expectedGroups, persona.expectedGroupItems);

      for (const groupId of persona.expectedGroups) {
        const count = await page.locator(`[data-navigation-group-id="${groupId}"]`).count();
        if (count !== 1) throw new Error(`Expected one ${groupId} group, received ${count}`);
      }

      for (const [groupId, itemIds] of Object.entries(persona.expectedGroupItems ?? {})) {
        for (const itemId of itemIds) {
          const count = await page.locator(
            `[data-navigation-group-id="${groupId}"] [data-navigation-item-id="${itemId}"]`,
          ).count();
          if (count !== 1) throw new Error(`Expected one ${groupId}/${itemId} item, received ${count}`);
        }
      }

      const sidebarGroupCount = await page.locator("[data-navigation-group-id]").count();
      if (sidebarGroupCount === 0) throw new Error("Workspace sidebar did not render");
      const renderedGroupIds = await page.locator("[data-navigation-group-id]").evaluateAll(
        (groups) => groups.map((group) => group.getAttribute("data-navigation-group-id")),
      );
      if (new Set(renderedGroupIds).size !== renderedGroupIds.length) {
        throw new Error(`Duplicate semantic navigation groups: ${renderedGroupIds.join(", ")}`);
      }

      const beforeRefreshPath = new URL(page.url()).pathname;
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForWorkspace(page, persona.expectedPath);
      await waitForStableNavigation(page, persona.expectedGroups, persona.expectedGroupItems);
      const afterRefreshPath = new URL(page.url()).pathname;
      if (afterRefreshPath !== beforeRefreshPath) {
        throw new Error(`Refresh changed route from ${beforeRefreshPath} to ${afterRefreshPath}`);
      }

      await page.getByTestId("workspace-account-menu-trigger").click();
      await page.getByTestId("workspace-account-sign-out").click();
      await page.waitForURL((url) => url.pathname === "/login", { timeout: 30_000 });

      if (!authResponses.some((response) => response === "200 /auth/v1/token")) {
        throw new Error("Login did not receive a successful authentication response");
      }
      if (browserErrors.length > 0) {
        throw new Error(`Uncaught browser errors: ${browserErrors.join(" | ")}`);
      }

      results.push({ persona: persona.name, status: "PASS", durationMs: Date.now() - startedAt });
    } catch (error) {
      results.push({
        persona: persona.name,
        status: "FAIL",
        durationMs: Date.now() - startedAt,
        pathname: new URL(page.url()).pathname,
        authResponses,
        browserErrors,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

for (const result of results) {
  console.log(JSON.stringify(result));
}

if (results.some((result) => result.status !== "PASS")) process.exitCode = 1;
