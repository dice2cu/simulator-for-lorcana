import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: 889e938ae41e
const abilityText = "Jafar's locations lose Ward until the start of his next turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Destructive Misstep",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("removes Ward from the casting Jafar player's locations, not the Illumineers' locations", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        const location = {
            ...{
                fullName: "Destination",
                names: ["Destination"] as const,
                type: "Location" as const,
                colors: [],
                subtypes: [],
                cost: 0,
                inkwell: false,
                moveCost: 5,
                willpower: 10,
                lore: 0,
            },
            abilities: [{ type: "Keyword" as const, keyword: { name: "Ward" as const } }],
        };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ ...location, fullName: "Illumineer location" }]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [location]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const jafarLocation = playerAt(scenarioGame, 2).play[0].card,
            other = playerAt(scenarioGame, 1).play[0].card;
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 2 && action.card.fullName === prototypeCardName,
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    2: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 3 }]);
                        expect(request.ink[0].player).toBe(2);
                        expect(request.ink[0].cards).toHaveLength(3);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [{ type: "Ink", player: 2, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] }],
                            },
                        };
                    }),
                    1: new ScriptedPlayer().on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: false } };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(scenarioRules().keyword(jafarLocation, "Ward")).toBe(0);
        expect(scenarioRules().keyword(other, "Ward")).toBe(1);
    });
});
