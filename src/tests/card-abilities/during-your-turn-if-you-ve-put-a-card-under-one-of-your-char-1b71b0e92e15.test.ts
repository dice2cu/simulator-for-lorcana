import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: 1b71b0e92e15
const abilityText =
    "During your turn, if you've put a card under one of your characters or locations this turn, this character takes no damage from challenges.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mulan - Standing Her Ground",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("prevents challenge damage on your turn only after a real tuck (%s)", async (tuck) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "HeiHei - Boat Snack"]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: {
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
                exerted: true,
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper"]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
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
                effect: {
                    type: "Move Card",
                    cards: { zone: "Deck", player: "You", position: "Top", take: 1 },
                    to: "Under",
                    under: { zone: "Play", player: "You", where: { name: "HeiHei" } },
                    faceDown: true,
                },
            },
        ]);
        const source = playerAt(scenarioGame, 1).play[0].card,
            defender = playerAt(scenarioGame, 2).play[0].card;
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
        if (tuck)
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
                const action: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source, defender };
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
        if (tuck) expect(inPlay(scenarioRules(), source).damage ?? 0).toBe(0);
        else expect(playerAt(scenarioGame, 1).discard).toContainEqual(source);
    });
});
