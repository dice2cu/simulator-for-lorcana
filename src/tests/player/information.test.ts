import { describe, expect, it } from "vitest";
import { startGame, startTurn } from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import { Rules } from "../../engine/rules";
import { RandomBot } from "../../bot/random-bot";
import { createBot } from "../../search/bots";
import type { CardIdentifier, PlayerNumber } from "../../model/identity";
import type { GameState } from "../../model/game-state";
import { initialState, type Seat } from "../../player/runner";
import { SeededRandom } from "../../player/random";
import { projectState, sight } from "../../player/projection";
import { projectRequest } from "../../player/requests";
import { referenceDecks } from "../fixtures/reference-decks";

/**
 * Swaps every identity the viewer cannot see among the hidden slots, keeping
 * zone sizes, exertion and everything visible unchanged.
 */
function indistinguishable(state: GameState, viewer: PlayerNumber, random: SeededRandom): GameState {
    const sees = sight(state, viewer);
    const copy: GameState = structuredClone(state);
    const slots: { get: () => CardIdentifier; set: (card: CardIdentifier) => void }[] = [];
    for (const position of Object.values(copy.players)) {
        if (!position) continue;
        for (const zone of [position.deck, position.hand])
            zone.forEach((card, i) => {
                if (!sees(card)) slots.push({ get: () => zone[i], set: (next) => (zone[i] = next) });
            });
        position.inkwell.forEach((ink, i) => {
            if (!sees(ink.card))
                slots.push({ get: () => position.inkwell[i].card, set: (next) => (position.inkwell[i] = { ...position.inkwell[i], card: next }) });
        });
        for (const card of position.play)
            card.under?.forEach((under, i) => {
                if (!sees(under.card)) slots.push({ get: () => card.under![i].card, set: (next) => (card.under![i] = { ...card.under![i], card: next }) });
            });
    }
    const shuffled = random.shuffle(slots.map((slot) => slot.get()));
    slots.forEach((slot, i) => slot.set(shuffled[i]));
    return copy;
}

const order = (count: number) => Array.from({ length: count }, (_, i) => i);

describe("information boundaries", () => {
    it("projects the same view and requests when hidden cards are rearranged", () => {
        let checks = 0,
            decisions = 0;
        for (let game = 0; game < 6; game++) {
            const random = new SeededRandom(game + 50);
            const decks = [referenceDecks[game].cards, referenceDecks[(game + 4) % referenceDecks.length].cards];
            const bots = decks.map((deck, i) => new RandomBot({ deck, seed: game * 3 + i }));
            const seats: Seat[] = bots.map((controller, i) => ({ player: (i + 1) as PlayerNumber, deck: decks[i], controller }));
            const drive = (live: Resolution): GameState => {
                while (live.request) {
                    const request = live.request;
                    if (request.type === "Shuffle" || request.type === "Random Cards") {
                        const cards = random.shuffle(request.cards);
                        live.submit({
                            type: "Random",
                            outcome: request.type === "Shuffle" ? { type: "Shuffle", cards } : { type: "Random Cards", cards: cards.slice(0, request.count) },
                        });
                        continue;
                    }
                    const player = typeof request.player === "number" ? request.player : request.player.together[0];
                    const position = live.position!,
                        rules = live.rules!;
                    const projected = projectRequest(request, rules, sight(position, player), order);
                    for (const viewer of [1, 2] as PlayerNumber[]) {
                        const alternative = indistinguishable(position, viewer, random);
                        expect(projectState(alternative, sight(alternative, viewer))).toEqual(projectState(position, sight(position, viewer)));
                        checks++;
                    }
                    const alternative = indistinguishable(position, player, random);
                    const fresh = (state: GameState) => projectRequest(request, new Rules(state), sight(state, player), order).request;
                    expect(fresh(alternative)).toEqual(fresh(position));
                    if (request.type === "Action" && checks % 7 === 0) {
                        // Alternate a confirmed list and an imperfect scouted list, with sampled worlds.
                        const opposing = decks[2 - player];
                        const scouted = [...opposing.slice(2), { fullName: "Pete - Games Referee", count: 4 }];
                        const knowledge =
                            decisions % 2 ? { type: "Confirmed" as const, cards: opposing } : { type: "Scouted" as const, cards: scouted, confidence: 0.6 };
                        const bot = () =>
                            createBot({
                                player,
                                deck: decks[player - 1],
                                opponents: { [3 - player]: knowledge },
                                settings: { seed: 3, search: { nodes: 12, samples: 2 } },
                            });
                        const decide = (state: GameState) => {
                            const instance = bot();
                            const view = projectState(state, sight(state, player));
                            instance.observe({ state: view, turn: { steps: [] }, observations: [] });
                            return instance.decide(view, fresh(state));
                        };
                        expect(decide(alternative)).toEqual(decide(position));
                        decisions++;
                    }
                    const answer = bots[player - 1].decide(projectState(position, sight(position, player)), projected.request);
                    live.submit(projected.toStep(answer));
                }
                return live.result!;
            };
            let state = drive(startGame(initialState(seats, 1, new SeededRandom(game))));
            for (let turn = 0; turn < 40; turn++) {
                const live = startTurn(state);
                state = drive(live);
                if (live.outcome) break;
            }
        }
        expect(checks).toBeGreaterThan(100);
        expect(decisions).toBeGreaterThan(5);
    }, 120000);
});
