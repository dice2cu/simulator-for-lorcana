import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { describe, expect, it } from "vitest";
// Generated ability ID: fca64ad14322
const abilityText = "While you have another Hero character in play, this character gets +1 ◊.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Anna - Braving the Storm",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("requires another friendly Hero (%s)", (hero) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, ...(hero ? ["Hercules - Divine Hero"] : [])]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Hercules - Divine Hero"]);
        const source = playerAt(scenarioGame, 1).play[0].card;
        const definition = scenarioCards.definition(source.fullName);
        if (definition.type !== "Character") throw new Error("Expected a character");
        expect(scenarioRules().characteristic(source, "Lore")).toBe(definition.lore + (hero ? 1 : 0));
    });
});
