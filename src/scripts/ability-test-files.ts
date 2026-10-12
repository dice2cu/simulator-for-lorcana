import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { CatalogCard } from "../cards.js";

export interface AbilityTestEntry {
    id: string;
    text: string;
    cards: string[];
}

const startMarker = "// BEGIN GENERATED CARD LIST";
const endMarker = "// END GENERATED CARD LIST";

/** Keep the original IDs so migration does not discard manually completed tests. */
export function effectId(text: string): string {
    return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 12);
}

export function abilityTestFileName(entry: AbilityTestEntry): string {
    const slug =
        entry.text
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 60)
            .replace(/-$/g, "") || "ability";
    return `${slug}-${entry.id}.test.ts`;
}

/** Discovery uses printed effect text, without the ability's printed title. */
export function abilityTestInventory(records: readonly CatalogCard[]): AbilityTestEntry[] {
    const canonical = new Map<string, CatalogCard>();
    for (const card of records) {
        // Match getCard: the first printing supplies the definition.
        if (!canonical.has(card.fullName)) canonical.set(card.fullName, card);
    }
    const effects = new Map<string, Map<string, number>>();
    for (const card of canonical.values()) {
        const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
        const standalone = card.type === "Action" ? (card.effects ?? []).map(normalize) : [];
        const abilityText = (ability: NonNullable<CatalogCard["abilities"]>[number]) =>
            normalize(ability.effect ?? (ability.type === "keyword" ? ability.fullText : ""));
        const texts = new Set([...standalone, ...(card.abilities ?? []).map(abilityText)]);
        for (const text of texts) {
            if (!text) continue;
            const source = standalone.includes(text)
                ? 0
                : (card.abilities ?? [])
                      .filter((ability) => abilityText(ability) === text)
                      .reduce(
                          (best, ability) =>
                              Math.min(
                                  best,
                                  ability.type === "triggered"
                                      ? 10_000
                                      : ability.type === "keyword"
                                        ? 20_000
                                        : ability.type === "static"
                                          ? 30_000
                                          : ability.type === "activated"
                                            ? 40_000 + (ability.costs?.length ?? 0) * 1_000
                                            : 50_000,
                              ),
                          50_000,
                      );
            const rank =
                source +
                (/^Q\d/i.test(card.setCode) ? 1_000_000 : 0) +
                (/\b(?:if|while|unless|for each|choose one)\b/i.test(text) ? 100 : 0) +
                (card.abilities?.length ?? 0) +
                (card.effects?.length ?? 0);
            const names = effects.get(text) ?? new Map<string, number>();
            names.set(card.fullName, rank);
            effects.set(text, names);
        }
    }
    const entries = [...effects]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([text, names]) => ({
            id: effectId(text),
            text,
            cards: [...names].sort(([a, rankA], [b, rankB]) => rankA - rankB || a.localeCompare(b)).map(([name]) => name),
        }));
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error("Generated ability ID collision");
    return entries;
}

/** Only the contents between the card-list markers are generated on an existing test. */
export function updateAbilityCardList(source: string, entry: AbilityTestEntry): string {
    const match = source.match(/^\s*\/\/ Generated ability ID: ([a-f0-9]+)\s*$/m);
    if (match?.[1] !== entry.id) throw new Error("Effect ID does not match existing test");
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker);
    if (start < 0 || end < start) return source;
    if (source.indexOf(startMarker, start + startMarker.length) >= 0 || source.indexOf(endMarker, end + endMarker.length) >= 0)
        throw new Error("Ambiguous generated card-list markers");
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const indent = source.slice(source.lastIndexOf("\n", start) + 1, start);
    const contentStart = start + startMarker.length;
    const endLine = source.lastIndexOf("\n", end) + 1;
    return source.slice(0, contentStart) + newline + entry.cards.map((card) => `${indent}${JSON.stringify(card)},${newline}`).join("") + source.slice(endLine);
}

export function abilityTestStub(entry: AbilityTestEntry): string {
    return `import { describe, expect, it } from 'vitest';
import { ScriptedPlayer } from '../player/scripted-player';

// Generated ability ID: ${entry.id}
const abilityText = ${JSON.stringify(entry.text)};
const cardsWithEffect = [
    ${startMarker}
${entry.cards.map((card) => `    ${JSON.stringify(card)},`).join("\n")}
    ${endMarker}
];
const prototypeCardName = cardsWithEffect[0];

describe(abilityText, () => {
    it('behaves correctly', () => {
        const player = new ScriptedPlayer();
        expect.fail('TODO: use ' + prototypeCardName + ' to verify this ability');
    });
});
`;
}

/** Never replace a test body, including a stub that a programmer has started editing. */
export function writeAbilityTest(file: string, entry: AbilityTestEntry): "created" | "updated" | "unchanged" {
    if (!existsSync(file)) {
        writeFileSync(file, abilityTestStub(entry), { encoding: "utf8", flag: "wx" });
        return "created";
    }
    const source = readFileSync(file, "utf8");
    const updated = updateAbilityCardList(source, entry);
    if (source === updated) return "unchanged";
    writeFileSync(file, updated, "utf8");
    return "updated";
}
