import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { describe, expect, it } from "vitest";
// Generated ability ID: 25d6b26b239c
const abilityText = "Your Gargoyle characters lose the Stone by Day ability.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Angela - Night Warrior",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("suppresses a friendly Gargoyle Stone by Day only with this card (%s)", (present) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [...(present ? [prototypeCardName] : []), "Goliath - Guardian of Castle Wyvern"]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper", "Dinglehopper"]);
        const gargoyle = playerAt(scenarioGame, 1).play[present ? 1 : 0].card;
        const definition = scenarioCards.definition(gargoyle.fullName);
        const ability = definition.abilities?.find((ability) => "name" in ability && ability.name === "STONE BY DAY");
        if (!ability) throw new Error("Expected the printed Stone by Day ability");
        expect(scenarioRules().abilityActive(gargoyle, ability)).toBe(!present);
        expect(scenarioRules().restricted(gargoyle, "Can't Ready")).toBe(!present);
    });
});
