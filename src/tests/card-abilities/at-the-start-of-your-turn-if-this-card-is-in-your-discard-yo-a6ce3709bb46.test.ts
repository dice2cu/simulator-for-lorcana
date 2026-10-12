import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, isExerted } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/at-the-start-of-your-turn-if-this-card-is-in-your-discard-yo-a6ce3709bb46.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: a6ce3709bb46
const abilityText =
    "At the start of your turn, if this card is in your discard, you may choose and discard a card with ◉ to play this character for free and he enters play exerted.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Stitch - Experiment 626",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("requires discarding an inkable card to return exerted for free (accept: %s)", async (accept) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Inkable Payment",
                names: ["Inkable Payment"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: true,
                effect: { type: "Sequence", effects: [] },
            }),
            scenarioCards.fixture({
                fullName: "Not Inkable",
                names: ["Not Inkable"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 0 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).discard[0];
        const [payment, kept] = playerAt(scenarioGame, 1).hand;
        await (async () => {
            if (accept === true) {
                scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
                scenarioResolution = scenarioLive;
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer()
                            .on("Optional", (request) => {
                                return { type: "Decision", answer: { type: "Optional", accept: true } };
                            })
                            .on("Choose Cards", (request) => {
                                expect(request.min).toBe(1);
                                expect(request.max).toBe(1);
                                return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                            }),
                    },
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            }
            if (accept === false) {
                scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
                scenarioResolution = scenarioLive;
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer().on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: false } };
                        }),
                    },
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            }
            throw new Error("Unspecified script case");
        })();
        expect(playerAt(scenarioGame, 1).play.map((ink) => ink.card)).toEqual(accept ? [source] : []);
        expect(playerAt(scenarioGame, 1).discard).toEqual(accept ? [payment] : [source]);
        expect(playerAt(scenarioGame, 1).hand).toEqual(accept ? [kept] : [payment, kept]);
        if (accept) expect(!isExerted(scenarioRules(), source)).toBe(false);
        expect(playerAt(scenarioGame, 1).inkwell.map((ink) => ink.card)).toHaveLength(0);
    });
});
