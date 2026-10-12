import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/you-may-exert-4-items-of-yours-to-play-this-character-for-fr-70d0755cf830.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 70d0755cf830
const abilityText = "You may exert 4 items of yours to play this character for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Scrooge McDuck - Resourceful Miser",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(
            scenarioCards,
            Array.from({ length: 4 }, (_, i) => ({
                definition: scenarioCards.fixture({
                    fullName: "Item " + i,
                    names: ["Item " + i],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
                exerted: !true,
            })),
        );
        const player = playerAt(scenarioGame, 1),
            card = playerAt(scenarioGame, 1).hand[0];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && action.card.fullName === card.fullName,
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([
                            {
                                type: "Choose Cards",
                                from: {
                                    cards: [scenarioCards.instance(2), scenarioCards.instance(3), scenarioCards.instance(4), scenarioCards.instance(5)],
                                },
                                count: 4,
                                cost: [{ type: "Exert", cards: "Selected Cards" }],
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
                                    {
                                        type: "Exert",
                                        player: 1,
                                        cards: [scenarioCards.instance(2), scenarioCards.instance(3), scenarioCards.instance(4), scenarioCards.instance(5)],
                                    },
                                ],
                            },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(
            playerAt(scenarioGame, 1)
                .play.filter((x) => scenarioCards.definition(x.card.fullName).type === "Item")
                .every((x) => !!inPlay(scenarioRules(), x.card).exerted),
        ).toBe(true);
    });
});
