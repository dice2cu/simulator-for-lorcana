import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, keywords as cardKeywords } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/if-you-discarded-a-card-this-turn-this-character-gains-chall-e30e88396352.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: e30e88396352
const abilityText =
    "If you discarded a card this turn, this character gains Challenger +2 and can challenge ready characters this turn. (They get +2 ¤ while challenging.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Maximus - Relentless Stallion",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            "Dinglehopper",
            scenarioCards.fixture({
                fullName: "History Action",
                names: ["History Action"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Choose Cards", from: { zone: "Hand", player: "You" }, count: 1, effect: { type: "Discard", cards: "Selected Cards" } },
            }),
        ]);
        const source = playerAt(scenarioGame, 1).play[0];
        if (!source) throw new Error("Missing source");
        expect(cardKeywords(scenarioRules(), source.card)).not.toContain("Challenger");
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
        {
            if (!scenarioLive) throw new Error("No live turn");
            scenarioResolution = scenarioLive;
            const action: PlayerAction | undefined = (
                scenarioLive?.request?.type === "Action" ? scenarioLive.request.actions : getLegalActions(scenarioGame, { card: scenarioCards.lookup })
            ).find((action) => action.type === "Play" && action.player === 1 && action.card.fullName === "History Action");
            if (!action) throw new Error("Expected a legal action");
            scenarioResolution.submit({ type: "Action", action });
            resolvePlayers(
                scenarioResolution,
                {
                    1: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(4)] } };
                    }),
                },
                {
                    untilAction: true,
                },
            );
            scenarioGame = finished(scenarioResolution, true);
            if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
        }
        expect(cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase())).toContainEqual("challenger");
    });
});
