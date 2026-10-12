import { describe, expect, it } from "vitest";
import { RandomBot } from "../../bot/random-bot";
import { startGame, startTurn } from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import { applyTurn } from "../../engine/resume";
import type { GameState } from "../../model/game-state";
import type { PlayerNumber } from "../../model/identity";
import type { TurnStep } from "../../model/turn";
import { projectState, sight } from "../../player/projection";
import { SeededRandom } from "../../player/random";
import { projectRequest } from "../../player/requests";
import { initialState, type Seat } from "../../player/runner";
import { referenceDecks } from "../fixtures/reference-decks";

const order = (count: number) => Array.from({ length: count }, (_, i) => i);

/** Chooses the next input for whoever is asked: random outcomes or a random bot's answer. */
function next(live: Resolution, bots: RandomBot[], random: SeededRandom): TurnStep {
    const request = live.request!;
    if (request.type === "Shuffle") return { type: "Random", outcome: { type: "Shuffle", cards: random.shuffle(request.cards) } };
    if (request.type === "Random Cards") return { type: "Random", outcome: { type: "Random Cards", cards: random.shuffle(request.cards).slice(0, request.count) } };
    const player = typeof request.player === "number" ? request.player : request.player.together[0];
    const position = live.position!,
        sees = sight(position, player);
    const projected = projectRequest(request, live.rules!, sees, order);
    return projected.toStep(bots[player - 1].decide(projectState(position, sees), projected.request));
}

describe("turn branches", () => {
    it("continue exactly like the original turn, with its history and limits", () => {
        let compared = 0;
        for (let game = 0; game < 5; game++) {
            const decks = [referenceDecks[game].cards, referenceDecks[game + 6].cards];
            const bots = decks.map((deck, i) => new RandomBot({ deck, seed: game * 7 + i }));
            const random = new SeededRandom(game);
            const seats: Seat[] = decks.map((deck, i) => ({ player: (i + 1) as PlayerNumber, deck, controller: bots[i] }));
            const setup = startGame(initialState(seats, 1, new SeededRandom(game + 30)));
            while (setup.request) setup.submit(next(setup, bots, random));
            let state: GameState = setup.result!;
            for (let turn = 0; turn < 60; turn++) {
                const live = startTurn(state);
                while (live.request) {
                    const branch = live.branch();
                    if (live.request.type !== "Action") expect(branch).toBeUndefined();
                    else {
                        expect(branch).toBeDefined();
                        expect(branch!.request).toEqual(live.request);
                        // Drive both with the same inputs until the next intention or the end of the turn.
                        do {
                            const step = next(live, bots, random);
                            live.submit(step);
                            branch!.submit(step);
                            expect(branch!.position ?? branch!.result).toEqual(live.position ?? live.result);
                            expect(branch!.request).toEqual(live.request);
                            compared++;
                        } while (live.request && live.request.type !== "Action");
                        continue;
                    }
                    live.submit(next(live, bots, random));
                }
                expect(applyTurn(state, live.turn)).toEqual(live.result);
                state = live.result!;
                if (live.outcome) break;
            }
        }
        expect(compared).toBeGreaterThan(500);
    }, 120000);

    it("leaves the original unaffected when the branch takes another path", () => {
        const decks = [referenceDecks[1].cards, referenceDecks[7].cards];
        const bots = decks.map((deck, i) => new RandomBot({ deck, seed: i }));
        const random = new SeededRandom(3);
        const seats: Seat[] = decks.map((deck, i) => ({ player: (i + 1) as PlayerNumber, deck, controller: bots[i] }));
        const setup = startGame(initialState(seats, 1, new SeededRandom(4)));
        while (setup.request) setup.submit(next(setup, bots, random));
        let state: GameState = setup.result!;
        let branched = 0;
        for (let turn = 0; turn < 30 && branched < 20; turn++) {
            const live = startTurn(state);
            while (live.request) {
                const branch = live.branch();
                if (branch) {
                    // End the branch's turn immediately, whatever the original does next.
                    const end = branch.request!.type === "Action" ? branch.request!.actions.find((action) => action.type === "End Turn") : undefined;
                    if (end) branch.submit({ type: "Action", action: end });
                    branched++;
                }
                live.submit(next(live, bots, random));
            }
            expect(applyTurn(state, live.turn)).toEqual(live.result);
            state = live.result!;
            if (live.outcome) break;
        }
        expect(branched).toBeGreaterThan(10);
    }, 60000);
});
