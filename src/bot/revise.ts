import type { PlayerKnowledge } from "../model/bot";
import type { PlayerNumber } from "../model/identity";
import type { Strategy } from "../model/strategy";
import { getCard } from "../cards";
import { mechanics } from "./analysis";
import type { Insight } from "./insight";

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/**
 * Current priorities derived from the deck's underlying plan and what is known
 * now. Always starts from the base plan, so adjustments never accumulate. The
 * custom callback, resources and synergies are kept as supplied.
 */
export function revise(base: Strategy, insight: Insight, player: PlayerNumber, memory: Readonly<Partial<Record<PlayerNumber, PlayerKnowledge>>>): Strategy {
    const view = insight.view;
    const victory = insight.victoryLore(player);
    const opponents = insight.players().filter((other) => other !== player);
    const ours = view.players[player]?.lore ?? 0;
    const theirs = Math.max(0, ...opponents.map((other) => view.players[other]?.lore ?? 0));
    // Close to the end, stopping the leading opponent or finishing outweighs development.
    const danger = clamp((theirs - (victory - 10)) / 8, 0, 1);
    const reach = clamp((ours - (victory - 10)) / 8, 0, 1);
    const inkwell = view.players[player]?.inkwell.length ?? 0;
    const developed = inkwell >= base.resources.targetInk ? 1 : inkwell / Math.max(1, base.resources.targetInk);
    const hand = view.players[player]?.hand;
    const held = typeof hand === "number" ? hand : (hand?.length ?? 0);

    // Matchup: removal the opponents have shown makes exposed bodies riskier.
    const removal = new Set<string>();
    for (const other of opponents)
        for (const card of memory[other]?.seenCards ?? []) {
            const definition = getCard(card.fullName);
            if (definition && mechanics(definition).removal) removal.add(card.fullName);
        }
    const p = base.priorities;
    return {
        ...base,
        priorities: {
            lore: p.lore * (1 + 0.5 * reach + 0.25 * developed),
            boardControl: p.boardControl * (1 + 0.6 * danger),
            cards: p.cards * (held <= 1 ? 1.3 : 1) * (1 - 0.3 * danger),
            ink: p.ink * (1 - 0.5 * developed * developed),
            development: p.development * (1 - 0.3 * Math.max(reach, danger)),
        },
        caution: clamp(base.caution + 0.08 * removal.size, 0, 0.8),
    };
}
