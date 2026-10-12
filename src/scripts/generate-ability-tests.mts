import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { CatalogCard } from "../cards.js";
import {
    abilityTestFileName,
    abilityTestInventory,
    writeAbilityTest,
} from "./ability-test-files.js";

const catalog = JSON.parse(readFileSync(resolve("temp/allCards.json"), "utf8")) as {
    cards: CatalogCard[];
};
const directory = resolve("src/tests/card-abilities");
mkdirSync(directory, { recursive: true });
const entries = abilityTestInventory(catalog.cards);
const counts = { created: 0, updated: 0, unchanged: 0 };
for (const entry of entries)
    counts[writeAbilityTest(resolve(directory, abilityTestFileName(entry)), entry)]++;
console.log(
    `${entries.length} effects: ${counts.created} failing stubs created, ${counts.updated} card lists updated, ${counts.unchanged} unchanged.`,
);
const ids = new Set(entries.map((entry) => entry.id));
const obsolete = readdirSync(directory).filter((file) => {
    if (!file.endsWith(".test.ts")) return false;
    const match = readFileSync(resolve(directory, file), "utf8").match(
        /\/\/ Generated ability ID: ([a-f0-9]+)/,
    );
    return match && !ids.has(match[1]);
});
if (obsolete.length) console.log(`Obsolete tests retained for review:\n${obsolete.join("\n")}`);
