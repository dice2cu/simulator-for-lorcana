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
// Generated ability ID: 701cc0edaa47
const abilityText = "Villain characters gain “⟳, 3 ⬡ — Play a character with the same name as this character for free” while here.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Bad-Anon - Villain Support Center",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("grants a paid activated ability to the Villain at this location", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                ...{
                    fullName: "Enemy",
                    names: ["Enemy"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                },
                fullName: "Villain - In Play",
                names: ["Villain"],
                subtypes: ["Villain"],
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            {
                ...{
                    fullName: "Enemy",
                    names: ["Enemy"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                },
                fullName: "Villain - In Hand",
                names: ["Villain"],
                subtypes: ["Villain"],
                cost: 7,
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).play[0].card,
            villain = playerAt(scenarioGame, 1).play[1].card,
            copy = playerAt(scenarioGame, 1).hand[0];
        inPlay(scenarioRules(), villain).location = source;
        const action = (scenarioGame.turn.player !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).find(
            (action) => action.type === "Activate" && "card" in action && action.card.i === villain.i,
        );
        if (!action) throw new Error("Granted ability is not usable");
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = action;
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([
                                { type: "Exert", cards: { cards: [scenarioCards.instance(2)] } },
                                { type: "Ink", amount: 3 },
                            ]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(3);
                            return {
                                type: "Decision",
                                answer: {
                                    type: "Pay Cost",
                                    pay: true,
                                    payment: [
                                        { type: "Exert", player: 1, cards: [scenarioCards.instance(2)] },
                                        { type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] },
                                    ],
                                },
                            };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toEqual([]);
        expect(playerAt(scenarioGame, 1).play.map((state) => state.card)).toContainEqual(copy);
        expect(inPlay(scenarioRules(), villain).exerted).toBe(true);
        expect(playerAt(scenarioGame, 1).inkwell.every((ink) => ink.exerted)).toBe(true);
    });
});
