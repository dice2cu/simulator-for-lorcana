import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: adcf522d19ca
const abilityText = "If a character named Buzz Lightyear was banished this turn, you may play this item for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Buzz's Arm",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("unlocks the free item only after an actual Buzz Lightyear banishment", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                ...{
                    fullName: "Foe",
                    names: ["Foe"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 4,
                    willpower: 10,
                    lore: 0,
                },
                names: ["Buzz Lightyear"],
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            prototypeCardName,
            {
                ...{
                    fullName: "Preparation",
                    names: ["Preparation"] as const,
                    type: "Action" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Gain Lore" as const, player: "You" as const, amount: 0 },
                },
                effect: { type: "Banish", cards: { zone: "Play", player: "Opponents" } },
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper"]);
        const source = playerAt(scenarioGame, 1).hand[0];
        {
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
        }
        expect(
            (scenarioGame.turn.player !== scenarioGame.turn.player
                ? []
                : scenarioLive?.request?.type === "Action"
                  ? scenarioLive.request.actions
                  : getLegalActions(scenarioGame, { card: scenarioCards.lookup })
            ).some((action) => action.type === "Play" && action.card.i === source.i),
        ).toBe(false);
        expect(
            await (async () => {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = (
                    scenarioLive?.request?.type === "Action" ? scenarioLive.request.actions : getLegalActions(scenarioGame, { card: scenarioCards.lookup })
                ).find((action) => action.type === "Play" && action.player === 1 && action.card.fullName === "Preparation");
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {},
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            })(),
        ).toBe(true);
        expect(
            await (async () => {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = (
                    scenarioLive?.request?.type === "Action" ? scenarioLive.request.actions : getLegalActions(scenarioGame, { card: scenarioCards.lookup })
                ).find((action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName);
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {},
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).play.map((state) => state.card)).toEqual([source]);
        expect(playerAt(scenarioGame, 1).inkwell).toEqual([]);
    });
});
