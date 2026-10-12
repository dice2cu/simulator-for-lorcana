import type { PlayerKnowledge } from "../model/bot";
import type { GameStateView } from "../model/game-state-view";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { SeededRandom } from "../player/random";
import type { WorldFill } from "./insight";

type Memory = Partial<Record<PlayerNumber, PlayerKnowledge>>;

/**
 * Names for a view's unidentified hand and deck entries, drawn from the deck
 * lists the bot is allowed to know, minus cards it can already place. Players
 * without a list keep inert placeholders. A scouted list is used only with its
 * confidence, so a sample can leave room for cards outside that list.
 */
export function sampleFill(view: GameStateView, memory: Memory, random: SeededRandom): WorldFill {
    const owned = new Map<PlayerNumber, CardIdentifier[]>();
    const add = (player: PlayerNumber, card: CardIdentifier): void => {
        const list = owned.get(player) ?? [];
        list.push(card);
        owned.set(player, list);
    };
    for (const [seat, position] of Object.entries(view.players)) {
        if (!position) continue;
        const player = Number(seat) as PlayerNumber;
        for (const zone of [position.deck, position.hand, position.removed ?? 0]) if (typeof zone !== "number") for (const card of zone) if (card) add(player, card);
        for (const card of position.discard) add(player, card);
        for (const ink of position.inkwell) if (ink.card) add(player, ink.card);
        for (const card of position.play) {
            add(card.owner ?? player, card.card);
            for (const under of card.under ?? []) if (under.card) add(under.owner ?? player, under.card);
        }
    }
    const fill: { -readonly [P in PlayerNumber]?: { hand: string[]; deck: string[] } } = {};
    for (const [seat, position] of Object.entries(view.players)) {
        const player = Number(seat) as PlayerNumber;
        const knowledge = memory[player];
        const list = knowledge?.deck;
        if (!position || !list) continue;
        const remaining = new Map(list.cards.map((entry) => [entry.fullName, entry.count]));
        const placed = new Set<string>();
        for (const card of [...(owned.get(player) ?? []), ...(knowledge.inkwell ?? [])]) {
            const id = `${card.fullName}#${card.i}`;
            if (placed.has(id)) continue;
            placed.add(id);
            const count = remaining.get(card.fullName);
            if (count) remaining.set(card.fullName, count - 1);
        }
        let pool: string[] = [];
        for (const [name, count] of remaining) for (let copy = 0; copy < count; copy++) pool.push(name);
        if (list.type === "Scouted") pool = pool.filter(() => random.next() < list.confidence);
        pool = random.shuffle(pool);
        const hidden = (zone: typeof position.hand): number => (typeof zone === "number" ? zone : zone.filter((card) => !card).length);
        const hand = hidden(position.hand);
        fill[player] = { hand: pool.slice(0, hand), deck: pool.slice(hand, hand + hidden(position.deck)) };
    }
    return fill;
}
