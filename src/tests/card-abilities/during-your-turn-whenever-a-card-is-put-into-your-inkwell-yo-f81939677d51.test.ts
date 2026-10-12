import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: f81939677d51
const abilityText =
    "During your turn, whenever a card is put into your inkwell, you may reveal the top card of your deck. If it's an item card, you may play that item for free and they enter play exerted. Otherwise, put it on the bottom of your deck.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Oswald - The Lucky Rabbit",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("plays the revealed item for free and exerted after a real inking", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, ["Dinglehopper"]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, [
            { fullName: "Expensive item", names: ["Expensive item"], type: "Item", colors: [], subtypes: [], cost: 8, inkwell: false },
        ]);
        const ink = playerAt(scenarioGame, 1).hand[0],
            item = playerAt(scenarioGame, 1).deck[0];
        expect(
            await (async () => {
                scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
                scenarioResolution = scenarioLive;
                resolvePlayers(
                    scenarioResolution,
                    {},
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = { type: "Ink" as const, player: 1, card: ink };
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer()
                            .on("Optional", (request) => {
                                return { type: "Decision", answer: { type: "Optional", accept: true } };
                            })
                            .on("Optional", (request) => {
                                return { type: "Decision", answer: { type: "Optional", accept: true } };
                            }),
                    },
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            })(),
        ).toBe(true);
        expect(inPlay(scenarioRules(), item).exerted).toBe(true);
        expect(playerAt(scenarioGame, 1).deck).toEqual([]);
        expect(playerAt(scenarioGame, 1).inkwell).toEqual([{ card: ink, exerted: false }]);
    });
});
