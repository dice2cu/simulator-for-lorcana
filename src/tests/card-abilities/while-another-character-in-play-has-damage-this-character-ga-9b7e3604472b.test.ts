import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/while-another-character-in-play-has-damage-this-character-ga-9b7e3604472b.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 9b7e3604472b
const abilityText = "While another character in play has damage, this character gains Evasive. (Only characters with Evasive can challenge them.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Bill the Lizard - Chimney Sweep",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        (() => {
            const card = scenarioCards.create(scenarioCards.definition("Mickey Mouse - True Friend"));
            playerAt(scenarioGame, 2).play.push({ card, damage: 1, exerted: false, drying: false });
            return card;
        })();
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const ability: Ability = {
            type: "Static",
            rule: {
                type: "Conditional",
                if: { exists: { filter: { zone: "Play", cardType: "Character", exclude: "Self" }, where: { damage: { atLeast: 1 } } } },
                then: { type: "Modify Cards", cards: "Self", modifier: { gainKeyword: "Evasive" } },
            },
            name: "NOTHING TO IT",
        };
        expect(cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase())).toContainEqual("evasive");
    });
});
