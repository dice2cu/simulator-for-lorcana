import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/play-a-character-with-cost-up-to-2-more-than-the-banished-ch-2fa2196996b4.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 2fa2196996b4
const abilityText = "Play a character with cost up to 2 more than the banished character for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Retro Evolution Device",
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
                    fullName: "Shift Base",
                    names: ["Shift Base"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 3,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Eligible",
                names: ["Eligible"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 5,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
            scenarioCards.fixture({
                fullName: "Too Expensive",
                names: ["Too Expensive"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 6,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const victim = playerAt(scenarioGame, 1).play[1];
        const eligible = playerAt(scenarioGame, 1).hand[0];
        ({
            type: "Choose Cards",
            from: {
                zone: "Hand",
                cardType: "Character",
                where: { cost: { atMost: { add: [{ stat: "Cost", card: { result: "Paid Cards" } }, 2] } } },
                player: "You",
            },
            count: 1,
            effect: { type: "Play", cards: "Selected Cards", free: true },
        });
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 1 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        if (!scenarioCards.definition(source.card.fullName).abilities) throw new Error("Retro Evolution Device has no parsed abilities");
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) =>
                    action.player === 1 &&
                    ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source.card) && action.ability.i === 0) ||
                        (action.type === "Boost" && action.ability === 0 && sameCard(action.card, source.card))),
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([
                            { type: "Exert", cards: { cards: [scenarioCards.instance(1)] } },
                            { type: "Ink", amount: 1 },
                            {
                                type: "Choose Cards",
                                from: { cards: [scenarioCards.instance(2)] },
                                count: 1,
                                cost: [{ type: "Banish", cards: "Selected Cards" }],
                            },
                        ]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(1);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [
                                    { type: "Exert", player: 1, cards: [scenarioCards.instance(1)] },
                                    { type: "Ink", player: 1, cards: [request.ink[0].cards[0]] },
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
        }
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(victim.card);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(eligible);
        expect(playerAt(scenarioGame, 1).inkwell.every((card) => !!card.exerted)).toBe(true);
    });
});
