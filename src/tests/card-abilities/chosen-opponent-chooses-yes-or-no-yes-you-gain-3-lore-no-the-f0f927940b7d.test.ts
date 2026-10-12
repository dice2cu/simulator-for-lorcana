import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/chosen-opponent-chooses-yes-or-no-yes-you-gain-3-lore-no-the-f0f927940b7d.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: f0f927940b7d
const abilityText =
    "Chosen opponent chooses YES! or NO!: • YES! You gain 3 lore. • NO! They choose a character of theirs and put that card on the bottom of their deck.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Do You Want to Build A Snowman?",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName));
        const before = playerAt(scenarioGame, 1).lore;
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Player", (request) => {
                    expect(request.players).toEqual([2]);
                    return { type: "Decision", answer: { type: "Choose Player", player: 2 } };
                }),
                2: new ScriptedPlayer().on("Choose Mode", (request) => {
                    expect(request.options).toHaveLength(2);
                    return { type: "Decision", answer: { type: "Choose Mode", mode: 0 } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(before + 3);
    });
});
