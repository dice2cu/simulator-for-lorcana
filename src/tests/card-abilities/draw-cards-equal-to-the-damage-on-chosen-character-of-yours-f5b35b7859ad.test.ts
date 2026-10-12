import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/draw-cards-equal-to-the-damage-on-chosen-character-of-yours-f5b35b7859ad.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: f5b35b7859ad
const abilityText = "Draw cards equal to the damage on chosen character of yours, then banish them.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Dinner Bell",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Seven Dwarfs", "Princess"],
                    cost: 2,
                    inkwell: false,
                    strength: 3,
                    willpower: 8,
                    lore: 1,
                }),
                damage: 3,
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [prototypeCardName, prototypeCardName, prototypeCardName, prototypeCardName, prototypeCardName].reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const target = playerAt(scenarioGame, 1).play[1];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(1);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(3);
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(target.card);
    });
});
