import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/once-during-your-turn-you-may-choose-and-discard-a-card-to-d-7dff1fcd4015.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 7dff1fcd4015
const abilityText = "Once during your turn, you may choose and discard a card to deal 2 damage to chosen character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Angel - Experiment 624",
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
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const discarded = playerAt(scenarioGame, 1).hand[0];
        const target = playerAt(scenarioGame, 2).play[0];
        const abilityIndex = 1;
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) =>
                    action.player === 1 &&
                    ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source.card) && action.ability.i === abilityIndex) ||
                        (action.type === "Boost" && action.ability === abilityIndex && sameCard(action.card, source.card))),
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([
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
                            answer: { type: "Pay Cost", pay: true, payment: [{ type: "Discard", player: 1, cards: [scenarioCards.instance(2)] }] },
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
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(discarded);
        expect(inPlay(scenarioRules(), target.card).damage ?? 0).toBe(2);
    });
});
