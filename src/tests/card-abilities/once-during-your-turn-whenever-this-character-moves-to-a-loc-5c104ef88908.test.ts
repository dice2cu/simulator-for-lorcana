import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/once-during-your-turn-whenever-this-character-moves-to-a-loc-5c104ef88908.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 5c104ef88908
const abilityText =
    "Once during your turn, whenever this character moves to a location, you may move one of your other characters to that location for free. If you do, draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Goofy - Set for Adventure",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Drawn Card",
                    names: ["Drawn Card"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ].reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const ability: Effect = {
            type: "Optional",
            effect: {
                type: "Do Then",
                do: {
                    type: "Choose Cards",
                    from: { zone: "Play", player: "You", cardType: "Character", exclude: "Self" },
                    count: 1,
                    effect: { type: "Move To Location", cards: "Selected Cards", location: "Selected Cards", free: true },
                },
                then: { type: "Draw", player: "You", amount: 1 },
            },
        };
        const drawn = [...playerAt(scenarioGame, 1).deck].reverse()[0];
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "Mickey Mouse - True Friend", "Motunui - Island Paradise"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 1 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const [goofy, ally, location] = playerAt(scenarioGame, 1).play;
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Move", player: 1, card: goofy.card, location: location.card };
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
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(4)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(inPlay(scenarioRules(), ally.card).location).toEqual(location.card);
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(drawn);
    });
});
