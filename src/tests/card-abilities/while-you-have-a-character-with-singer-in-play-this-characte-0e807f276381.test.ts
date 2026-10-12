import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { describe, expect, it } from "vitest";
// Generated ability ID: 0e807f276381
const abilityText = "While you have a character with Singer in play, this character gets +1 ¤ and +1 ◊.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Roxanne - Powerline Fan",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("gains strength and lore only with a friendly Singer (%s)", (singer) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, ...(singer ? ["Ariel - Spectacular Singer"] : [])]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Ariel - Spectacular Singer"]);
        const source = playerAt(scenarioGame, 1).play[0].card;
        const definition = scenarioCards.definition(source.fullName);
        if (definition.type !== "Character") throw new Error("Expected a character");
        expect(scenarioRules().characteristic(source, "Strength")).toBe(definition.strength + (singer ? 1 : 0));
        expect(scenarioRules().characteristic(source, "Lore")).toBe(definition.lore + (singer ? 1 : 0));
    });
});
