import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { describe, expect, it } from "vitest";
// Generated ability ID: 3ab5ce81a2c6
const abilityText = "This location gets +1 ⛉ and +1 ◊ for each card under it.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Scrooge's Counting House - Ebenezer's Office",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 1, 2])("gets printed bonuses for %s distinct cards under it", (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const source = playerAt(scenarioGame, 1).play[0].card;
        inPlay(scenarioRules(), source).under = Array.from({ length: count }, () => "Pawpsicle").map((card) => ({
            card: scenarioCards.create(card),
            faceDown: true,
        }));
        const definition = scenarioCards.definition(source.fullName);
        if (definition.type !== "Location") throw new Error("Expected a location");
        expect(scenarioRules().characteristic(source, "Willpower")).toBe(definition.willpower + count);
        expect(scenarioRules().characteristic(source, "Lore")).toBe(definition.lore + count);
    });
});
