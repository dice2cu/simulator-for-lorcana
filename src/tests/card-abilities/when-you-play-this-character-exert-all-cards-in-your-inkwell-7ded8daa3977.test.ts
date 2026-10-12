import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/when-you-play-this-character-exert-all-cards-in-your-inkwell-7ded8daa3977.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 7ded8daa3977
const abilityText = "When you play this character, exert all cards in your inkwell, then return 2 cards at random from your inkwell to your hand.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mufasa - Ruler of Pride Rock",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).inkwell = cardIds(scenarioCards, ["Mickey Mouse - True Friend", "Donald Duck - Boisterous Fowl", "Dinglehopper"]).map(
            (card) => ({ card, exerted: false }),
        );
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(
                scenarioResolution,
                {},
                {
                    random: [{ type: "Random Cards", cards: [scenarioCards.instance(3), scenarioCards.instance(4)] }],
                },
            );
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(2);
        expect(playerAt(scenarioGame, 1).inkwell.map((ink) => ink.card)).toHaveLength(1);
    });
});
