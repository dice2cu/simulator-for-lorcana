import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
import { describe, expect, it } from "vitest";
// Generated ability ID: 3e1aa6657ccb
const abilityText = "While you have 2 or more other Amber characters in play, this character gains Singer 8. (They count as cost 8 to sing songs.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mickey Mouse - Amber Champion",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 1, 2])("requires two other friendly Amber characters (%s)", (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, ...Array.from({ length: count }, () => "HeiHei - Boat Snack")]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["HeiHei - Boat Snack", "HeiHei - Boat Snack"]);
        const source = playerAt(scenarioGame, 1).play[0].card;
        if (count === 2) expect(cardKeywords(scenarioRules(), source).map((keyword) => keyword.toLowerCase())).toContain("singer");
        else expect(cardKeywords(scenarioRules(), source).map((keyword) => keyword.toLowerCase())).not.toContain("singer");
        expect(scenarioRules().keyword(source, "Singer")).toBe(count === 2 ? 8 : 0);
    });
});
