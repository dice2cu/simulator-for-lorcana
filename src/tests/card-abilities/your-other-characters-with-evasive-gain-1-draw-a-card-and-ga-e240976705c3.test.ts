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
import { sameCard } from "../../engine/identity";
// Generated ability ID: e240976705c3
const abilityText = "Your other characters with Evasive gain “⟳, 1 ⬡ — Draw a card and gain 1 lore.”";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Dumbo - Ninth Wonder of the Universe",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("grants an Evasive ally its own paid draw-and-lore activation", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "Tinker Bell - Peter Pan's Ally"]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 1 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const ally = playerAt(scenarioGame, 1).play[1].card;
        const drawn = playerAt(scenarioGame, 1).deck[0];
        const before = playerAt(scenarioGame, 1).lore;
        const action = (1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).find(
            (action) => action.type === "Activate" && "card" in action && sameCard(action.card, ally),
        );
        if (!action) throw new Error("Expected a granted activation");
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = action;
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([
                            { type: "Exert", cards: { cards: [scenarioCards.instance(2)] } },
                            { type: "Ink", amount: 1 },
                        ]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(1);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [
                                    { type: "Exert", player: 1, cards: [scenarioCards.instance(2)] },
                                    { type: "Ink", player: 1, cards: [request.ink[0].cards[0]] },
                                ],
                            },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(inPlay(scenarioRules(), ally).exerted).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(drawn);
        expect(playerAt(scenarioGame, 1).lore).toBe(before + 1);
    });
});
