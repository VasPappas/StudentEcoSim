/**
 * The engine must run without the interface. tsconfig.engine.json already
 * keeps browser and Node types out of it; this test also keeps out imports of
 * anything but the engine's own files and the test runner.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("the engine stands alone", () => {
  it("imports only its own files, its test data and the test runner", () => {
    const root = join(import.meta.dirname, "..", "engine");
    const offenders: string[] = [];
    for (const path of files(root).filter((name) => name.endsWith(".ts"))) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/from\s+"([^"]+)"/g)) {
        const target = match[1];
        const inside = target.startsWith("./") || target.startsWith("../");
        const escapes = inside && !join(path, "..", target).startsWith(root);
        const runner = target === "vitest" && path.endsWith(".test.ts");
        if ((!inside && !runner) || escapes) offenders.push(`${path} imports ${target}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
