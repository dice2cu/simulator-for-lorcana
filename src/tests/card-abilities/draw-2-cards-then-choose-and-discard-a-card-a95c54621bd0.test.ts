// Converted from reference/card-abilities/draw-2-cards-then-choose-and-discard-a-card-a95c54621bd0.test.ts
import { describe, expect, it } from "vitest";
import { ScriptedPlayer } from "../player/scripted-player";
import { playGame } from "../../player/runner";
import { sameCard } from "../../engine/identity";
import type { GameState, PlayerPosition } from "../../model/game-state";
import type { CardIdentifier } from "../../model/identity";
import type { Effect } from "../../model/ability";
// Generated ability ID: a95c54621bd0
const abilityText = "Draw 2 cards, then choose and discard a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Strike a Good Match",
    "Starlight Vial",
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
        p1.deck = ["Dinglehopper", "Magic Mirror"].reverse().map(makeCard);
        p1.inkwell = Array.from({ length: 2 }, () => ({ card: makeCard("Dinglehopper"), exerted: false }));
        const player = p1;
        const discarded = [...p1.deck].reverse()[0];
        const played = p1.hand.find((card) => card.fullName === prototypeCardName);
        if (!played) throw new Error("Missing played card");
        scripted
            .action((action) => action.type === "Play" && sameCard(action.card, played))
            .on("Pay Cost", (request) => {
                expect(request.optional).toBe(false);
                expect(request.cost).toEqual([{ type: "Ink", amount: 2 }]);
                const offered = request.ink.find((ink) => ink.player === 1);
                if (!offered) throw new Error("Missing ready ink");
                expect(offered.cards.length).toBeGreaterThanOrEqual(2);
                return { type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: offered.cards.slice(0, 2) }] } };
            });
        scripted.on("Choose Cards", (request) => {
            const chosen = [discarded];
            expect(request.min).toBeLessThanOrEqual(chosen.length);
            expect(request.max).toBeGreaterThanOrEqual(chosen.length);
            for (const card of chosen) expect(request.cards).toContainEqual(card);
            return { type: "Decision", answer: { type: "Choose Cards", cards: chosen } };
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
        expect(result1.hand).toHaveLength(1);
        expect(result1.discard).toContainEqual(discarded);
    });
});
