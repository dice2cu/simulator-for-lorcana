import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, keywords as cardKeywords } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/look-at-the-top-2-cards-of-your-deck-put-one-into-your-hand-8c73b9b00c69.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 8c73b9b00c69
const abilityText =
    "Look at the top 2 cards of your deck. Put one into your hand and the other into your inkwell facedown and exerted. If a character sang this song, your characters gain Ward until the start of your next turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "What Else Can I Do?",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, ["Mickey Mouse - Brave Little Tailor", "Mickey Mouse - True Friend"]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
        const player = playerAt(scenarioGame, 1);
        const singer = player.play[0];
        const target = player.play[1];
        const song = player.hand[0];
        const selected = player.deck[0];
        if (!singer || !target || !song || !selected) throw new Error("Incomplete song fixture");
        {
            const action0: PlayerAction | undefined = { type: "Sing", player: 1, song, singers: [singer.card] };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(1);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(4)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(cardKeywords(scenarioRules(), target.card)).toContain("Ward");
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(selected);
        expect(playerAt(scenarioGame, 1).inkwell).toHaveLength(1);
        expect(playerAt(scenarioGame, 1).inkwell[0]?.exerted).toBe(true);
    });
});
