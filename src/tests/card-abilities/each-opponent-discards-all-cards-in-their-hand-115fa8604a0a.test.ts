// Converted from reference/card-abilities/each-opponent-discards-all-cards-in-their-hand-115fa8604a0a.test.ts
import { describe, expect, it } from "vitest";
import { ScriptedPlayer } from "../player/scripted-player";
import { playGame } from "../../player/runner";
import { sameCard } from "../../engine/identity";
import type { GameState, PlayerPosition } from "../../model/game-state";
import type { CardIdentifier } from "../../model/identity";
import type { Effect } from "../../model/ability";

// Generated ability ID: 115fa8604a0a
const abilityText = "Each opponent discards all cards in their hand.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Bend to My Will",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        let serial = 0;
        const makeCard = (fullName: string): CardIdentifier => ({ fullName, i: ++serial });
        const p1: PlayerPosition = { lore: 0, turnsTaken: 0, deck: [], hand: [], play: [], discard: [], inkwell: [] };
        const p2: PlayerPosition = { lore: 0, turnsTaken: 0, deck: [], hand: [], play: [], discard: [], inkwell: [] };
        const state: GameState = { turn: { number: 1, player: 1 }, players: { 1: p1, 2: p2 } };
        const scripted = new ScriptedPlayer();
        p1.hand = [prototypeCardName].map(makeCard);
        p2.hand = ["Dinglehopper", "Magic Mirror"].map(makeCard);
        p1.inkwell = Array.from({ length: 7 }, () => ({ card: makeCard("Dinglehopper"), exerted: false }));
        const opponent = p2;
        const discarded = [...p2.hand];

        const played = p1.hand.find((card) => card.fullName === prototypeCardName);
        if (!played) throw new Error("Missing played card");
        scripted
            .action((action) => action.type === "Play" && sameCard(action.card, played))
            .on("Pay Cost", (request) => {
                expect(request.optional).toBe(false);
                expect(request.cost).toEqual([{ type: "Ink", amount: 7 }]);
                const offered = request.ink.find((ink) => ink.player === 1);
                if (!offered) throw new Error("Missing ready ink");
                expect(offered.cards.length).toBeGreaterThanOrEqual(7);
                return { type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: offered.cards.slice(0, 7) }] } };
            });
        scripted.action((action) => action.type === "End Turn");
        const record = playGame(
            [
                { player: 1, deck: [], controller: scripted },
                { player: 2, deck: [], controller: new ScriptedPlayer() },
            ],
            { seed: 1, from: state, turns: 1, audit: true },
        );
        const result1 = record.final.players[1],
            result2 = record.final.players[2];
        if (!result1 || !result2) throw new Error("A scenario player was eliminated");
        expect(result2.hand).toHaveLength(0);
        expect(result2.discard).toEqual(expect.arrayContaining(discarded));
    });
});
