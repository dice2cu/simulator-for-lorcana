import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: 3adbd429f3b5
const abilityText = "Whenever you play a location, you may move this character and up to 1 of your other characters to that location for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Carl Fredricksen - On the Move",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("moves the source and chosen friend to the location actually played, without paying its move cost", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "HeiHei - Boat Snack"]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            {
                fullName: "Destination",
                names: ["Destination"],
                type: "Location",
                colors: [],
                subtypes: [],
                cost: 1,
                inkwell: false,
                moveCost: 5,
                willpower: 10,
                lore: 0,
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 1 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).play[0].card,
            friend = playerAt(scenarioGame, 1).play[1].card;
        const destination = playerAt(scenarioGame, 1).hand[0];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && action.card.fullName === destination.fullName,
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 1 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(1);
                            return {
                                type: "Decision",
                                answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0]] }] },
                            };
                        })
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(0);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(inPlay(scenarioRules(), source).location).toEqual(destination);
        expect(inPlay(scenarioRules(), friend).location).toEqual(destination);
        expect(playerAt(scenarioGame, 1).inkwell.every((ink) => ink.exerted)).toBe(true);
    });
});
