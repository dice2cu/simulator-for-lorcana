import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/gain-lore-equal-to-the-discarded-character-s-7db850399bd3.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 7db850399bd3
const abilityText = "Gain lore equal to the discarded character's ◊.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Queen - Disguised Peddler",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Discarded Friend",
                names: ["Discarded Friend"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 2,
            }),
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const discarded = playerAt(scenarioGame, 1).hand[0];
        const index = scenarioCards.definition(source.card.fullName).abilities?.findIndex((ability) => ability.type === "Activated") ?? -1;
        // ⟳, choose and discard a character card: gain lore equal to its ◊
        // The character in hand is the only legal card for the discard cost.
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) =>
                        action.player === 1 &&
                        ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source.card) && action.ability.i === index) ||
                            (action.type === "Boost" && action.ability === index && sameCard(action.card, source.card))),
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([
                            { type: "Exert", cards: { cards: [scenarioCards.instance(1)] } },
                            {
                                type: "Choose Cards",
                                from: { cards: [scenarioCards.instance(2)] },
                                count: 1,
                                cost: [{ type: "Discard", cards: "Selected Cards" }],
                            },
                        ]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(0);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [
                                    { type: "Exert", player: 1, cards: [scenarioCards.instance(1)] },
                                    { type: "Discard", player: 1, cards: [scenarioCards.instance(2)] },
                                ],
                            },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(discarded);
        expect(playerAt(scenarioGame, 1).lore).toBe(2);
    });
});
