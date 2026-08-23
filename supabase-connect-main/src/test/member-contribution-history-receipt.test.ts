import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const queries = read("src/lib/member-contributions.ts");
const history = read("src/pages/portal/PortalContributionHistoryPage.tsx");
const receipt = read("src/pages/portal/PortalContributionReceiptPage.tsx");
const routes = read("src/routes/MemberRoutes.tsx");

describe("Wave 4B member contribution authorization", () => {
  it("scopes history by the resolved church and linked member with a bounded range", () => {
    const body = queries.slice(queries.indexOf("fetchMemberContributionPage"), queries.indexOf("fetchMemberContributionReceipt"));
    expect(body).toContain('.eq("church_id", churchId)');
    expect(body).toContain('.eq("member_id", memberId)');
    expect(body).toContain(".range(from, to)");
  });

  it("requires contribution id, church id, and member id for receipt reads", () => {
    const body = queries.slice(queries.indexOf("fetchMemberContributionReceipt"));
    expect(body).toContain('.eq("id", contributionId)');
    expect(body).toContain('.eq("church_id", churchId)');
    expect(body).toContain('.eq("member_id", memberId)');
    expect(body).toContain(".maybeSingle()");
    expect(queries).not.toContain("currency");
  });

  it("keeps receipt printing behind the authorized record render", () => {
    expect(receipt).toContain("!member || !contribution ? <Unavailable />");
    expect(receipt.indexOf("window.print()")).toBeGreaterThan(receipt.indexOf("!contribution"));
    expect(receipt).not.toContain("location.state");
    expect(receipt).not.toContain("searchParams");
  });

  it("renders safe unavailable states for missing, foreign, and unknown records", () => {
    expect(receipt).toContain("if (!contributionId) return <Unavailable />");
    expect(receipt).toContain("receipt.isError || !member || !contribution");
    expect(receipt).toContain("huna ruhusa ya kuiona");
  });

  it("mounts history and direct-refresh receipt routes for portal and member aliases", () => {
    const registry = readFileSync(join(process.cwd(), "src/lib/member-service-registry.ts"), "utf8");
    expect(routes).toContain('path="contribution-history"');
    expect(routes).toContain('path="contribution-receipt/:contributionId"');
    expect(registry).toContain('path: "/portal/contribution-history"');
    expect(history).toContain("/portal/contribution-receipt/${row.id}");
  });

  it("keeps post-Wave 4B routes bounded to approved releases", () => {
    expect(routes).toContain('path="radio"');
    expect(routes).toContain('path="kanisa-ai"');
    expect(routes).toContain("<UlizaKanisaFeatureGate>");
  });
});
