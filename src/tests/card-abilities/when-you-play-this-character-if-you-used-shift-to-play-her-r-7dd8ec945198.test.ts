import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-you-play-this-character-if-you-used-shift-to-play-her-r-7dd8ec945198.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
import type { Effect } from "../../model/ability";
// Generated ability ID: 7dd8ec945198
const abilityText = "When you play this character, if you used Shift to play her, return all other exerted characters to their players' hands.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Jasmine - Royal Commodore",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Friendly",
                    names: ["Friendly"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !false,
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Opposing",
                    names: ["Opposing"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            friendly = playerAt(scenarioGame, 1).play[1],
            opponent = playerAt(scenarioGame, 2),
            opposing = playerAt(scenarioGame, 2).play[0],
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 1);
        {
            const fixtureSource = source.card,
                position = playerAt(scenarioGame, 1);
            const state = position.play.find((state) => sameCard(state.card, fixtureSource));
            const definition = scenarioCards.definition(fixtureSource.fullName);
            if (!state || definition.type !== "Character") throw new Error("Expected character fixture");
            const keyword = definition.abilities?.find((ability) => ability.type === "Keyword" && ability.keyword.name === "Shift");
            if (!keyword || keyword.type !== "Keyword" || keyword.keyword.name !== "Shift") throw new Error("Missing Shift");
            const base = scenarioCards.create({
                fullName: "Shift base for " + fixtureSource.fullName,
                names: definition.names,
                type: "Character",
                colors: definition.colors,
                subtypes: definition.subtypes,
                cost: 0,
                inkwell: false,
                strength: 0,
                willpower: Math.max(definition.willpower, (state.damage ?? 0) + 1),
                lore: 0,
            });
            position.play = position.play.map((state) => (sameCard(state.card, fixtureSource) ? { ...state, card: base } : state));
            position.hand.push(fixtureSource);
            const ink = keyword.keyword.cost.reduce((sum, cost) => {
                if (cost.type !== "Ink" || typeof cost.amount !== "number") throw new Error("Expected ink cost");
                return sum + cost.amount;
            }, 0);
            position.inkwell = Array.from({ length: ink }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
            const action0: PlayerAction | undefined = {
                type: "Shift",
                player: 1,
                card: scenarioCards.instance(1),
                onto: [scenarioCards.instance(4)],
                ability: 0,
            };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Pay Cost", (request) => {
                    expect(request.optional).toBe(false);
                    expect(request.cost).toEqual([{ type: "Ink", amount: 5 }]);
                    expect(request.ink[0].player).toBe(1);
                    expect(request.ink[0].cards).toHaveLength(5);
                    return {
                        type: "Decision",
                        answer: {
                            type: "Pay Cost",
                            pay: true,
                            payment: [
                                {
                                    type: "Ink",
                                    player: 1,
                                    cards: [
                                        request.ink[0].cards[0],
                                        request.ink[0].cards[1],
                                        request.ink[0].cards[2],
                                        request.ink[0].cards[3],
                                        request.ink[0].cards[4],
                                    ],
                                },
                            ],
                        },
                    };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(friendly.card);
        expect(playerAt(scenarioGame, 2).hand).toContainEqual(opposing.card);
    });
});
