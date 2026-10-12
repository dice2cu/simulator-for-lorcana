import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: 7435497f34cc
const abilityText = "Play a character with the same name as the banished character for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Hades - Double Dealer",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("pays a real banishment cost and plays only a matching name for free", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                ...{
                    fullName: "Victim",
                    names: ["Victim"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                },
                fullName: "Matching base",
                names: ["Matching"],
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            {
                ...{
                    fullName: "Victim",
                    names: ["Victim"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                },
                fullName: "Matching card",
                names: ["Matching"],
                cost: 8,
            },
            {
                ...{
                    fullName: "Victim",
                    names: ["Victim"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                },
                fullName: "Other",
                names: ["Other"],
                cost: 1,
            },
        ]);
        const source = playerAt(scenarioGame, 1).play[0].card,
            victim = playerAt(scenarioGame, 1).play[1].card,
            matching = playerAt(scenarioGame, 1).hand[0],
            other = playerAt(scenarioGame, 1).hand[1];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) =>
                        action.player === 1 &&
                        ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source) && action.ability.i === 0) ||
                            (action.type === "Boost" && action.ability === 0 && sameCard(action.card, source))),
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([
                                { type: "Exert", cards: { cards: [scenarioCards.instance(1)] } },
                                {
                                    type: "Choose Cards",
                                    from: { cards: [scenarioCards.instance(2)] },
                                    count: 1,
                                    cost: [{ type: "Banish", cards: "Selected Cards" }],
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
                                        { type: "Banish", player: 1, cards: [scenarioCards.instance(2)] },
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
        expect(playerAt(scenarioGame, 1).hand).toEqual([other]);
        expect(playerAt(scenarioGame, 1).play.map((state) => state.card)).toEqual([source, matching]);
        expect(playerAt(scenarioGame, 1).discard).toEqual([victim]);
        expect(playerAt(scenarioGame, 1).inkwell).toEqual([]);
    });
});
