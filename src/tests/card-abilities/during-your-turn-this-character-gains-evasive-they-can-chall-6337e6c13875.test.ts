import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/during-your-turn-this-character-gains-evasive-they-can-chall-6337e6c13875.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 6337e6c13875
const abilityText = "During your turn, this character gains Evasive. (They can challenge characters with Evasive.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Captain Amelia - First in Command",
    "Cruella De Vil - Fashionable Cruiser",
    "Flintheart Glomgold - Lone Cheater",
    "Genie - Satisfied Dragon",
    "Happy - Lively Knight",
    "Jafar - Royal Vizier",
    "Magic Broom - Aerial Cleaner",
    "Mr. Smee - Steadfast Mate",
    "Grumpy - Skeptical Knight",
    "HeiHei - Not-So-Tricky Chicken",
    "Helga Sinclair - Tough as Nails",
    "Jasmine - Fearless Princess",
    "Little John - Robin's Pal",
    "Robin Hood - Unrivaled Archer",
    "Scrooge McDuck - Richest Duck in the World",
    "Simba - Returned King",
    "Triton - Young Prince",
    "Wasabi - Methodical Engineer",
    "Zipper - Flying Ranger",
    "Mulan - Charging Ahead",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const ability: Ability = {
            type: "Static",
            rule: { type: "Conditional", if: { duringTurnOf: "You" }, then: { type: "Modify Cards", cards: "Self", modifier: { gainKeyword: "Evasive" } } },
            name: "DISCIPLINE",
        };
        expect(cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase())).toContainEqual("evasive");
    });
});
