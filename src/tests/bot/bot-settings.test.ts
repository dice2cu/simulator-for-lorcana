import { describe, expect, it } from "vitest";
import { createBot } from "../../search/bots";
import { RandomBot } from "../../bot/random-bot";
import { analyzeDeck } from "../../bot/analysis";
import type { BotSetup } from "../../model/bot";
import type { GameStateView } from "../../model/game-state-view";
import type { PlayerAnswer, PlayerController, PlayerRequest } from "../../model/player-interaction";
import type { Strategy } from "../../model/strategy";
import { playGame, type Seat } from "../../player/runner";
import { referenceDecks } from "../fixtures/reference-decks";

const deck = referenceDecks[1].cards,
    other = referenceDecks[6].cards;

/** Records the bot's answers over the opening turns of one game. */
function decisions(setup: Omit<BotSetup, "player" | "deck">, seed = 4): string[] {
    const answers: string[] = [];
    const bot = createBot({ player: 1, deck, ...setup });
    const recorder: PlayerController = {
        observe: (update) => bot.observe(update),
        decide: (state: GameStateView, request: PlayerRequest) => {
            const answer = bot.decide(state, request) as PlayerAnswer;
            answers.push(JSON.stringify(answer));
            return answer;
        },
    };
    const seats: Seat[] = [
        { player: 1, deck, controller: recorder },
        { player: 2, deck: other, controller: new RandomBot({ deck: other, seed }) },
    ];
    try {
        playGame(seats, { seed, maxTurns: 12 });
    } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("did not finish")) throw error;
    }
    return answers;
}

describe("bot settings and strategies", () => {
    it("validates difficulty settings at construction", () => {
        expect(() => createBot({ player: 1, deck, settings: { seed: 1, search: { nodes: 0, samples: 0 }, randomness: 1.5 } })).toThrow(/randomness/);
        expect(() => createBot({ player: 1, deck, settings: { seed: 1, search: { nodes: -1, samples: 0 } } })).toThrow();
    });

    it("plays reproducibly with the same seeds", () => {
        const settings = { seed: 9, search: { nodes: 12, samples: 1 }, randomness: 0.3 };
        expect(decisions({ settings })).toEqual(decisions({ settings }));
    }, 120000);

    it("keeps the best choice at zero randomness and deviates when randomness is set", () => {
        const best = decisions({ settings: { seed: 9, search: { nodes: 0, samples: 0 } } });
        expect(decisions({ settings: { seed: 10, search: { nodes: 0, samples: 0 } } })).toEqual(best);
        expect(decisions({ settings: { seed: 9, search: { nodes: 0, samples: 0 }, randomness: 1 } })).not.toEqual(best);
    }, 120000);

    it("lets a supplied strategy answer specific requests and delegate the rest", () => {
        let handled = 0,
            delegated = 0;
        const strategy: Strategy = {
            ...analyzeDeck(deck),
            choose: (_state, request) => {
                if (request.type !== "Action") return undefined;
                const quest = request.actions.find((entry) => entry.action.type === "Quest");
                if (!quest) {
                    delegated++;
                    return undefined;
                }
                handled++;
                return { type: "Action", option: quest.option };
            },
        };
        const answers = decisions({ strategy, settings: { seed: 1, search: { nodes: 8, samples: 1 } } });
        expect(handled).toBeGreaterThan(0);
        expect(delegated).toBeGreaterThan(0);
        expect(answers.length).toBeGreaterThan(handled);
    }, 120000);

    it("generates mixed priorities from parsed mechanics", () => {
        const strategies = referenceDecks.map((reference) => analyzeDeck(reference.cards));
        for (const strategy of strategies) {
            for (const weight of Object.values(strategy.priorities)) expect(weight).toBeGreaterThan(0);
            expect(strategy.resources.targetInk).toBeGreaterThanOrEqual(4);
            expect(strategy.caution).toBeGreaterThanOrEqual(0);
            expect(strategy.caution).toBeLessThanOrEqual(1);
        }
        expect(new Set(strategies.map((strategy) => JSON.stringify(strategy.priorities))).size).toBeGreaterThan(referenceDecks.length / 2);
    });
});
