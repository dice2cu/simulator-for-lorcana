import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/you-may-put-a-toy-character-card-from-your-discard-on-the-bo-a82c1bee02f8.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: a82c1bee02f8
const abilityText = "You may put a Toy character card from your discard on the bottom of your deck to play this character for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Hand-in-the-Box - Sid's Toy",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Toy",
                names: ["Toy"],
                type: "Character",
                colors: ["Amber"],
                subtypes: ["Toy"],
                cost: 0,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 0 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const card = playerAt(scenarioGame, 1).hand[0];
        const toy = playerAt(scenarioGame, 1).discard[0];
        // The Toy is the only eligible card for the alternate play cost.
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && sameCard(action.card, card),
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([
                            {
                                type: "Choose Cards",
                                from: { cards: [scenarioCards.instance(2)] },
                                count: 1,
                                cost: [{ type: "Move Card", cards: "Selected Cards", to: "Deck Bottom" }],
                            },
                        ]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(0);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [{ type: "Move Card", player: 1, cards: [scenarioCards.instance(2)], to: "Deck Bottom" }],
                            },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect([...playerAt(scenarioGame, 1).deck].reverse()[0]).toEqual(toy);
        expect(playerAt(scenarioGame, 1).discard).not.toContainEqual(toy);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(card);
    });
});
