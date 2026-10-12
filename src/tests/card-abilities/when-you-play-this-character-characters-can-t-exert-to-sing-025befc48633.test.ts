import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/when-you-play-this-character-characters-can-t-exert-to-sing-025befc48633.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 025befc48633
const abilityText = "When you play this character, characters can't exert to sing songs until the start of your next turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Gantu - Experienced Enforcer",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            prototypeCardName,
            scenarioCards.fixture({
                fullName: "Own Song",
                names: ["Own Song"],
                type: "Action",
                colors: ["Amber"],
                subtypes: ["Song"],
                cost: 1,
                playRules: [{ type: "Sing", cost: 1 }],
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Own Singer",
                    names: ["Own Singer"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 5,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !true,
            },
        ]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Opposing Song",
                names: ["Opposing Song"],
                type: "Action",
                colors: ["Amber"],
                subtypes: ["Song"],
                cost: 1,
                playRules: [{ type: "Sing", cost: 1 }],
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Opposing Singer",
                    names: ["Opposing Singer"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 5,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !true,
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 20 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).hand[0];
        const ownSong = playerAt(scenarioGame, 1).hand[1];
        const opposingSong = playerAt(scenarioGame, 2).hand[0];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && sameCard(action.card, source),
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 4 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(20);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [
                                    {
                                        type: "Ink",
                                        player: 1,
                                        cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2], request.ink[0].cards[3]],
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
        const ownActions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        const opposingActions = 2 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(ownActions.some((action) => action.type === "Sing" && sameCard(cardInAction(action), ownSong))).toBe(false);
        expect(opposingActions.some((action) => action.type === "Sing" && sameCard(cardInAction(action), opposingSong))).toBe(false);
    });
});
