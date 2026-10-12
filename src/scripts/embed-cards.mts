import { readFileSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import type { CatalogCard } from "../cards.js";
import type { Card, CardBase } from "../model/card.js";
import type { Subtype } from "../model/identity.js";
import { addCardNames, parseCard } from "../parser/index.ts";

// npm scripts run from the project root. The script is bundled into temp/ before it runs.
const root = process.cwd();

// Only gameplay, display and parser fields enter the bundle.
const cardFields = [
    "id",
    "setCode",
    "fullName",
    "fullText",
    "name",
    "names",
    "version",
    "type",
    "color",
    "cost",
    "inkwell",
    "strength",
    "willpower",
    "lore",
    "moveCost",
    "subtypes",
    "abilities",
    "effects",
];
const abilityFields = ["type", "name", "effect", "fullText", "keyword", "keywordValue", "keywordValueNumber", "reminderText", "costs", "costsText"];

function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a catalog object");
    return value as Record<string, unknown>;
}

function pick(value: unknown, fields: readonly string[]): Record<string, unknown> {
    const source = object(value);
    return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

function validateFields(
    node: Record<string, unknown>,
    required: readonly string[],
    strings: readonly string[],
    numbers: readonly string[],
    arrays: readonly string[],
): void {
    for (const field of required) {
        if (node[field] === undefined) throw new Error(`Missing required catalog field: ${field}`);
    }
    for (const field of strings) {
        if (node[field] !== undefined && typeof node[field] !== "string") throw new Error(`Expected text in ${field}`);
    }
    for (const field of numbers) {
        const value = node[field];
        if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
            throw new Error(`Expected a finite number in ${field}`);
        }
    }
    for (const field of arrays) {
        const value = node[field];
        if (value !== undefined && (!Array.isArray(value) || !value.every((entry) => typeof entry === "string"))) {
            throw new Error(`Expected an array of text in ${field}`);
        }
    }
}

export function readCatalog(raw: unknown): { cards: CatalogCard[] } {
    const catalog = object(raw);
    if (!Array.isArray(catalog.cards)) throw new Error("Catalog must contain a cards array");
    const ids = new Set<number>();
    const cards = catalog.cards.map((value) => {
        const card = pick(value, cardFields);
        if (card.type !== "Action") delete card.effects;
        validateFields(
            card,
            ["id", "setCode", "fullName", "fullText", "name", "type", "color", "cost", "inkwell"],
            ["setCode", "fullName", "fullText", "name", "version", "type", "color"],
            ["id", "cost", "strength", "willpower", "lore", "moveCost"],
            ["names", "subtypes", "effects"],
        );
        if (typeof card.inkwell !== "boolean") throw new Error("Expected a boolean in inkwell");
        if (typeof card.id !== "number" || !Number.isSafeInteger(card.id) || ids.has(card.id)) {
            throw new Error(`Invalid or duplicate printing ID: ${String(card.id)}`);
        }
        ids.add(card.id);
        if (card.abilities !== undefined) {
            if (!Array.isArray(card.abilities)) throw new Error("Expected an abilities array");
            card.abilities = card.abilities.map((value) => {
                const ability = pick(value, abilityFields);
                validateFields(
                    ability,
                    ["type", "fullText"],
                    ["type", "name", "effect", "fullText", "keyword", "keywordValue", "reminderText", "costsText"],
                    ["keywordValueNumber"],
                    ["costs"],
                );
                return ability;
            });
        }
        return card;
    });
    // The source fields and nested ability fields have been checked above.
    return { cards: cards as unknown as CatalogCard[] };
}

const subtypes = new Set<Subtype>([
    "Alien",
    "Ally",
    "Broom",
    "Captain",
    "Colossus",
    "Deity",
    "Detective",
    "Dinosaur",
    "Dragon",
    "Dreamborn",
    "Entangled",
    "Fairy",
    "Floodborn",
    "Gargoyle",
    "Ghost",
    "Giant",
    "Hero",
    "Hunny",
    "Hyena",
    "Hyperia City",
    "Illusion",
    "Inventor",
    "King",
    "Knight",
    "Madrigal",
    "Mentor",
    "Monster",
    "Musketeer",
    "Obstacle",
    "Pirate",
    "Prince",
    "Princess",
    "Puppy",
    "Queen",
    "Racer",
    "Red Panda",
    "Robot",
    "Seven Dwarfs",
    "Song",
    "Sorcerer",
    "Storyborn",
    "Super",
    "Team",
    "Tigger",
    "Titan",
    "Toy",
    "Villain",
    "Vineling",
    "Whisper",
]);

function isSubtype(value: string): value is Subtype {
    return [...subtypes].some((subtype) => subtype === value);
}

function isColor(value: string): value is CardBase["colors"][number] {
    return ["Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"].includes(value);
}

/** Converts printed properties and parses the printed text into rules. */
export function convertCard(source: CatalogCard): Card {
    const names = source.names ?? [source.name];
    const firstName = names[0];
    if (!firstName || names.some((name) => !name)) throw new Error("Card must have nonempty printed names");
    const colors = source.color ? source.color.split("-") : [];
    if (!colors.every(isColor)) throw new Error(`Unknown ink color: ${source.color}`);
    const printedSubtypes = source.subtypes ?? [];
    if (!printedSubtypes.every(isSubtype)) throw new Error(`Unknown subtype: ${printedSubtypes.join(", ")}`);
    const base: CardBase = {
        fullName: source.fullName,
        ...(source.fullText === '' ? {} : { fullText: source.fullText }),
        names: [firstName, ...names.slice(1)],
        colors,
        cost: source.cost,
        inkwell: source.inkwell,
        subtypes: printedSubtypes,
    };
    function stat(field: "strength" | "willpower" | "lore" | "moveCost"): number {
        const value = source[field];
        // An absent printed lore value means no lore, not an unknown stat.
        if (field === "lore" && value === undefined) return 0;
        if (value === undefined) throw new Error(`Missing required stat: ${field}`);
        return value;
    }
    if (!["Action", "Character", "Item", "Location"].includes(source.type)) throw new Error(`Unknown card type: ${source.type}`);
    const parsed = parseCard(source);
    if (!parsed.supported) {
        throw new Error(parsed.issues.map((issue) => `${issue.source} ${issue.index + 1}: ${issue.reason}`).join("; "));
    }
    const rules = parsed.rules;
    switch (rules.type) {
        case "Action":
            return compact({ ...base, ...rules });
        case "Character":
            return compact({ ...base, ...rules, type: "Character", strength: stat("strength"), willpower: stat("willpower"), lore: stat("lore") });
        case "Item":
            return compact({ ...base, ...rules, type: "Item" });
        case "Location":
            return compact({ ...base, ...rules, type: "Location", willpower: stat("willpower"), lore: stat("lore"), moveCost: stat("moveCost") });
    }
}

/** Omits empty ability and play rule lists to keep the embedded JSON small. */
function compact<T extends { abilities?: readonly unknown[]; playRules?: readonly unknown[] }>(card: T): T {
    const result = { ...card };
    if (!result.abilities?.length) delete result.abilities;
    if (!result.playRules?.length) delete result.playRules;
    return result;
}

export class CatalogConversionError extends Error {
    readonly issues: { card: string; reason: string }[];
    constructor(issues: { card: string; reason: string }[]) {
        super(`Cannot embed catalog: ${issues.length} printings failed conversion. Existing cards.json was not changed.`);
        this.issues = issues;
    }
}

export function processCatalog(raw: unknown): { cards: Card[] } {
    const source = readCatalog(raw);
    // Names on new cards may not be in the embedded catalog yet.
    addCardNames(source.cards);
    const cards: Card[] = [];
    const issues: CatalogConversionError["issues"] = [];
    for (const card of source.cards) {
        try {
            cards.push(convertCard(card));
        } catch (error) {
            issues.push({ card: card.fullName, reason: error instanceof Error ? error.message : String(error) });
        }
    }
    if (issues.length) throw new CatalogConversionError(issues);
    return { cards };
}

export function embedCards(input: string): void {
    const output = resolve(root, "src/data/cards.json");
    const report = resolve(root, "reports/embed-cards.json");
    const writeReport = (issues: CatalogConversionError["issues"]): void => {
        mkdirSync(dirname(report), { recursive: true });
        writeFileSync(report, JSON.stringify({ issues }, null, 2) + "\n");
    };
    const raw: unknown = JSON.parse(readFileSync(input, "utf8"));
    let catalog: { cards: Card[] };
    try {
        catalog = processCatalog(raw);
    } catch (error) {
        if (error instanceof CatalogConversionError) {
            writeReport(error.issues);
            console.error(`Conversion failures: ${report}`);
        }
        throw error;
    }
    // A successful run clears failures reported by an earlier one.
    writeReport([]);
    mkdirSync(dirname(output), { recursive: true });
    const json = JSON.stringify(catalog, null, 2) + "\n";
    const temporary = `${output}.tmp`;
    writeFileSync(temporary, json);
    renameSync(temporary, output);
    console.log(`Embedded ${catalog.cards.length} printings: ${(Buffer.byteLength(json) / 1024 / 1024).toFixed(2)} MiB`);
}

if (process.argv[1] && /embed-cards\.m[jt]s$/.test(import.meta.url) && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    try {
        embedCards(resolve(root, "temp/allCards.json"));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
