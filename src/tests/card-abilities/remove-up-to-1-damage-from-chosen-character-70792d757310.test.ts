import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/remove-up-to-1-damage-from-chosen-character-70792d757310.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 70792d757310
const abilityText = "Remove up to 1 damage from chosen character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Dinglehopper",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Damaged Character",
                    names: ["Damaged Character"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 5,
                    lore: 0,
                }),
                damage: 2,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const item = playerAt(scenarioGame, 1).play.find((card) => card.card.fullName === prototypeCardName);
        const target = playerAt(scenarioGame, 1).play.find((card) => card.card.fullName === "Damaged Character");
        if (!item || !target) throw new Error("Expected the item and damaged character in play.");
        const used = await (async () => {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) =>
                    action.player === 1 &&
                    ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, item.card) && action.ability.i === 0) ||
                        (action.type === "Boost" && action.ability === 0 && sameCard(action.card, item.card))),
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Exert", cards: { cards: [scenarioCards.instance(1)] } }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(0);
                        return {
                            type: "Decision",
                            answer: { type: "Pay Cost", pay: true, payment: [{ type: "Exert", player: 1, cards: [scenarioCards.instance(1)] }] },
                        };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    })
                    .on("Choose Amount", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Amount", amount: 1 } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
            return true;
        })();
        expect(used).toBe(true);
        expect(!inPlay(scenarioRules(), item.card).exerted).toBe(false);
        expect(inPlay(scenarioRules(), target.card).damage ?? 0).toBe(1);
    });
});
