import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Operations and Audio Processing feature controls", () => {
  const registry = read("src/components/workspace/registry.ts");
  const featureManagement = read("src/pages/super-admin/FeatureManagement.tsx");
  const migration = read("supabase/migrations/20260713123000_register_operations_feature_controls.sql");

  it("lets Super Admin manage Operations and Audio Processing as first-class features", () => {
    expect(featureManagement).toContain('key: "operations"');
    expect(featureManagement).toContain('key: "audio_processing"');
    expect(migration).toContain("'operations'");
    expect(migration).toContain("'audio_processing'");
    expect(migration).toContain("on conflict (key) do update");
  });

  it("gates Church Admin sidebar visibility with the dedicated feature keys", () => {
    expect(registry).toContain('id: "operations", label: "Operations", to: "/church-admin/operations", icon: Bell, featureFlag: "operations"');
    expect(registry).toContain('id: "audio-processing", label: "Audio Processing", to: "/church-admin/audio", icon: AudioLines, featureFlag: "audio_processing"');
    expect(registry).not.toContain('id: "audio-processing", label: "Audio Processing", to: "/church-admin/audio", icon: AudioLines, featureFlag: "catholic_content"');
  });
});
