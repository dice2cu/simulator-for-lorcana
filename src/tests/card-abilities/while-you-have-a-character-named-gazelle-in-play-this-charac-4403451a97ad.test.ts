import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
import { describe, expect, it } from "vitest";
// Generated ability ID: 4403451a97ad
const abilityText = "While you have a character named Gazelle in play, this character gains Singer 6. (This character counts as cost 6 to sing songs.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Chief Bogo - Gazelle Fan",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("requires a friendly character named Gazelle (%s)", (friendly) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, ...(friendly ? ["Gazelle - Angel with Horns"] : [])]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Gazelle - Angel with Horns"]);
        const source = playerAt(scenarioGame, 1).play[0].card;
        if (friendly) expect(cardKeywords(scenarioRules(), source).map((keyword) => keyword.toLowerCase())).toContain("singer");
        else expect(cardKeywords(scenarioRules(), source).map((keyword) => keyword.toLowerCase())).not.toContain("singer");
        expect(scenarioRules().keyword(source, "Singer")).toBe(friendly ? 6 : 0);
    });
});
