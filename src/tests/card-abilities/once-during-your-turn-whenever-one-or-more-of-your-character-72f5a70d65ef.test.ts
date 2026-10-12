import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: 72f5a70d65ef
const abilityText = "Once during your turn, whenever one or more of your characters sings a song, you may ready those characters.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Alma Madrigal - Accepting Grandmother",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("readies the whole singing group once, not after the second song", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                ...{
                    fullName: "Victim",
                    names: ["Victim"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                },
                fullName: "Singer A",
                cost: 2,
            },
            {
                ...{
                    fullName: "Victim",
                    names: ["Victim"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                },
                fullName: "Singer B",
                cost: 2,
            },
        ]);
        const song = {
            fullName: "Together song",
            names: ["Together song"] as const,
            type: "Action" as const,
            colors: [],
            subtypes: ["Song"] as const,
            cost: 4,
            inkwell: false,
            playRules: [{ type: "Sing Together" as const, cost: 4 }],
            effect: { type: "Gain Lore" as const, player: "You" as const, amount: 0 },
        };
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [song, song]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper"]);
        const singers = playerAt(scenarioGame, 1)
                .play.slice(1)
                .map((state) => state.card),
            songs = [...playerAt(scenarioGame, 1).hand];
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
            await (async () => {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = { type: "Sing", player: 1, song: songs[0], singers };
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer().on("Optional", (request) => {
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
        expect(singers.every((card) => !inPlay(scenarioRules(), card).exerted)).toBe(true);
        expect(
            await (async () => {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = { type: "Sing", player: 1, song: songs[1], singers };
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
        expect(singers.every((card) => inPlay(scenarioRules(), card).exerted)).toBe(true);
    });
});
