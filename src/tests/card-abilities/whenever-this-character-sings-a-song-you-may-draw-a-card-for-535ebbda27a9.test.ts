import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: 535ebbda27a9
const abilityText = "Whenever this character sings a song, you may draw a card for each character you have in play.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Bruno Madrigal - Singing Seer",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 2])("draws for every friendly character after actually singing (%s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, ...Array(count).fill("HeiHei - Boat Snack")]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            {
                fullName: "Test song",
                names: ["Test song"],
                type: "Action",
                colors: [],
                subtypes: ["Song"],
                cost: 1,
                inkwell: false,
                playRules: [{ type: "Sing", cost: 1 }],
                effect: { type: "Gain Lore", player: "You", amount: 1 },
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, Array(5).fill("Dinglehopper"));
        const source = playerAt(scenarioGame, 1).play[0].card,
            song = playerAt(scenarioGame, 1).hand[0],
            deck = [...playerAt(scenarioGame, 1).deck];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Sing", player: 1, song, singers: [source] };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toEqual(deck.slice(0, count + 1));
        expect(playerAt(scenarioGame, 1).deck).toEqual(deck.slice(count + 1));
        expect(inPlay(scenarioRules(), source).exerted).toBe(true);
    });
});
