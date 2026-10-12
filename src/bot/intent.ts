import type { CardChange, CardRestriction, Effect } from "../model/ability";
import type { CardFacts } from "./insight";

const protective = new Set<CardRestriction>(["Can't Be Challenged", "Can't Be Dealt Damage", "Can't Be Chosen"]);

/**
 * Whether an effect helps (positive) or harms (negative) the cards chosen for it,
 * read from the printed instructions that act on Selected Cards. Zero when the
 * effect does not say, such as a choice made only to count or reveal cards.
 * Movement depends on where the chosen cards are: leaving play harms them,
 * returning from the discard or deck helps.
 */
export function stance(effect: Effect | undefined, zone: CardFacts["zone"] | undefined): number {
    let score = 0;
    const visit = (value: unknown): void => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (!value || typeof value !== "object") return;
        const node = value as Record<string, unknown>;
        // A nested choice rebinds Selected Cards for its own effect.
        if (node.type === "Choose Cards" && node !== effect) return;
        if (selects(node.cards)) score += instruction(node, zone);
        if (node.type === "Move Damage") score += (selects(node.from) ? 1 : 0) - (selects(node.to) ? 2 : 0);
        // A chosen destination: our location to move to, or our character to put cards under.
        if (selects(node.location) || selects(node.under)) score += 1;
        // Gains measured by a chosen card prefer the largest.
        if ((node.type === "Gain Lore" || node.type === "Draw") && JSON.stringify(node.amount ?? null).includes('"card":"Selected Cards"')) score += 1;
        for (const [field, entry] of Object.entries(node)) if (field !== "cards" && field !== "from" && field !== "to") visit(entry);
    };
    visit(effect);
    return Math.sign(score);
}

/** The chosen cards themselves, alone or together with others, not cards selected relative to them. */
function selects(selection: unknown): boolean {
    if (selection === "Selected Cards") return true;
    const union = typeof selection === "object" && selection !== null ? (selection as { union?: unknown }).union : undefined;
    return Array.isArray(union) && union.some(selects);
}

function instruction(node: Record<string, unknown>, zone: CardFacts["zone"] | undefined): number {
    switch (node.type) {
        case "Banish":
        case "Gain Control":
            return -3;
        case "Deal Damage":
        case "Put Damage":
            return -2;
        case "Exert":
        case "Discard":
            return -1;
        case "Ready":
        case "Remove Damage":
        case "Enter Play":
        case "Play":
            return 2;
        case "Move To Location":
            return 1;
        case "Move Card":
            if (zone === "Play") return -2;
            if (zone === "Hand") return -1;
            return node.to === "Hand" ? 2 : 0;
        case "Modify Cards":
            return change(node.modifier as CardChange);
        default:
            return 0;
    }
}

function change(modifier: CardChange | undefined): number {
    if (!modifier) return 0;
    if ("stat" in modifier) return typeof modifier.amount === "number" && modifier.amount < 0 ? -1 : 1;
    if ("gainKeyword" in modifier) return modifier.gainKeyword === "Reckless" ? -1 : 1;
    if ("loseKeyword" in modifier || "loseAbility" in modifier) return -1;
    if ("restriction" in modifier) return protective.has(modifier.restriction) ? 1 : -1;
    if ("permission" in modifier || "preventDamage" in modifier || "gainAbility" in modifier) return 1;
    return 0;
}
