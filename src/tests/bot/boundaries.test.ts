import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");

/** Every module a source folder imports, as paths relative to src. */
function imports(folder: string): { file: string; target: string }[] {
    const result: { file: string; target: string }[] = [];
    for (const name of readdirSync(join(root, folder))) {
        if (!name.endsWith(".ts")) continue;
        const text = readFileSync(join(root, folder, name), "utf8");
        for (const match of text.matchAll(/(?:import|export)[^;]*?from\s+["']([^"']+)["']/g)) {
            const specifier = match[1];
            const target = specifier.startsWith(".") ? relative(root, join(root, folder, specifier)).replace(/\\/g, "/") : specifier;
            result.push({ file: `${folder}/${name}`, target });
        }
    }
    return result;
}

describe("engine-access boundaries", () => {
    it("keeps bot policy and strategy analysis away from authoritative engine types", () => {
        const allowed = (target: string) => (target.startsWith("model/") && target !== "model/game-state") || target === "cards" || target === "player/random" || target.startsWith("bot/");
        const found = imports("bot");
        expect(found.filter((entry) => entry.target.startsWith("model/")).length).toBeGreaterThan(10);
        expect(found.filter((entry) => !allowed(entry.target))).toEqual([]);
    });

    it("lets search build positions only from views, never from the runner", () => {
        const violations = imports("search").filter((entry) => entry.target === "player/runner" || entry.target.startsWith("tests/"));
        expect(violations).toEqual([]);
    });

    it("keeps the runner and projection independent of any bot", () => {
        const violations = imports("player").filter((entry) => entry.target.startsWith("bot/") || entry.target.startsWith("search/"));
        expect(violations).toEqual([]);
    });

    it("keeps the engine free of players, bots and Node imports", () => {
        const violations = imports("engine").filter((entry) => /^(player|bot|search)\//.test(entry.target) || entry.target.startsWith("node:"));
        expect(violations).toEqual([]);
    });
});
