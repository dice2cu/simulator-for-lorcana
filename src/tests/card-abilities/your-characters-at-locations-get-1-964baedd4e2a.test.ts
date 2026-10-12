import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/your-characters-at-locations-get-1-964baedd4e2a.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 964baedd4e2a
const abilityText = "Your characters at locations get +1 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Russell - Senior Wilderness Explorer",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Stabbington Brother",
                    names: ["Stabbington Brother", "Magic Broom", "Robin Hood", "Stitch"],
                    type: "Character",
                    colors: ["Ruby"],
                    subtypes: ["Gargoyle", "Pirate", "Princess", "Toy"],
                    abilities: [
                        { type: "Keyword", keyword: { name: "Evasive" } },
                        { type: "Keyword", keyword: { name: "Support" } },
                        { type: "Keyword", keyword: { name: "Rush" } },
                        { type: "Keyword", keyword: { name: "Reckless" } },
                    ],
                    cost: 0,
                    inkwell: false,
                    strength: 8,
                    willpower: 5,
                    lore: 1,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 1).play[1],
            ability: Ability = {
                type: "Static",
                rule: {
                    type: "Modify Cards",
                    cards: { zone: "Play", player: "You", cardType: "Character", where: { at: { zone: "Play", cardType: "Location" } } },
                    modifier: { stat: "Strength", amount: 1 },
                },
                name: "BASE CAMP",
            };
        target.location = (() => {
            const card = scenarioCards.create(scenarioCards.definition("Motunui - Island Paradise"));
            playerAt(scenarioGame, 1).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        const keywords = cardKeywords(scenarioRules(), target.card).map((x) => x.toLowerCase());
        expect(scenarioRules().characteristic(target.card, "Strength")).toBe(8 + 1);
    });
});
