import { describe, expect, it } from "vitest";

import { DEFAULT_LOGIN_REDIRECT, normalizeLoginRedirect } from "@/lib/login-redirect";

const origin = "https://staging.kanisa.example";

describe("normalizeLoginRedirect", () => {
  it.each([
    ["/portal", "/portal"],
    ["/portal/dashboard?tab=history&receipt=abc#latest", "/portal/dashboard?tab=history&receipt=abc#latest"],
    ["/church-admin/contributions?month=2026-10", "/church-admin/contributions?month=2026-10"],
    ["/super-admin/system-health", "/super-admin/system-health"],
    ["/diocese/123e4567-e89b-12d3-a456-426614174000/reports", "/diocese/123e4567-e89b-12d3-a456-426614174000/reports"],
    ["/community/community-1/dashboard", "/community/community-1/dashboard"],
    ["/invite/token-1?email=member@example.test", "/invite/token-1?email=member@example.test"],
    [`${origin}/portal/dashboard?from=login`, "/portal/dashboard?from=login"],
  ])("accepts safe application redirect %s", (value, expected) => {
    expect(normalizeLoginRedirect(value, { origin })).toBe(expected);
  });

  it.each([
    null,
    "",
    " /portal",
    "/portal ",
    "//evil.example/portal",
    "https://evil.example/portal",
    "/\\evil",
    "/%5Cevil",
    "/%2Fevil",
    "%2Fportal",
    "/portal%00/dashboard",
    "/portal%252Fdashboard",
    "/portal%255Cdashboard",
    "/portal%2500dashboard",
    "/portal\n/dashboard",
    "/portal/../church-admin",
    "/unexpected",
    "not-a-path",
    "http://%",
  ])("falls back for unsafe redirect %s", (value) => {
    expect(normalizeLoginRedirect(value, { origin })).toBe(DEFAULT_LOGIN_REDIRECT);
  });

  it("uses the provided safe fallback for invalid redirect values", () => {
    expect(normalizeLoginRedirect("https://evil.example", { origin, fallback: "/church-admin" })).toBe("/church-admin");
  });
});
