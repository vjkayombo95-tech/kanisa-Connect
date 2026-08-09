import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadHtmlFixture(fixtureName: string): Promise<string> {
  const fixturePath = path.join(import.meta.dirname, fixtureName);
  return readFile(fixturePath, "utf8");
}
