import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/at-the-end-of-your-turn-if-this-character-is-exerted-choose-97eb423085dc.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 97eb423085dc
const abilityText = "At the end of your turn, if this character is exerted, choose and discard a card or banish him.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Meeko - Skittish Scrounger",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName], !false);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Discarded",
                names: ["Discarded"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        const p = playerAt(scenarioGame, 1),
            s = playerAt(scenarioGame, 1).play[0],
            card = playerAt(scenarioGame, 1).hand[0],
            a: Effect = printedEffect(scenarioCards.definition(s.card.fullName), 1);
        {
            const sourceDefinition = scenarioCards.definition(s.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                a,
                { card: s.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Choose Mode", (request) => {
                        expect(request.options).toHaveLength(2);
                        return { type: "Decision", answer: { type: "Choose Mode", mode: 0 } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(card);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(s.card);
    });
});
