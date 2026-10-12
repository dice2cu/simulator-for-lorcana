import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/while-you-have-an-item-card-in-your-discard-this-character-g-7ab3c3a68020.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 7ab3c3a68020
const abilityText = "While you have an item card in your discard, this character gains Evasive. (Only characters with Evasive can challenge them.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Lumiere - Nimble Candelabra",
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
                    fullName: "Condition",
                    names: ["Condition"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Broom", "Hunny", "Captain", "Hero", "Puppy", "Queen", "Villain", "Alien", "Robot", "Pirate"],
                    abilities: [
                        { type: "Keyword", keyword: { name: "Evasive" } },
                        { type: "Keyword", keyword: { name: "Support" } },
                    ],
                    cost: 0,
                    inkwell: false,
                    strength: 8,
                    willpower: 5,
                    lore: 1,
                }),
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Condition Two",
                    names: ["Condition Two"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Broom", "Hunny", "Puppy", "Pirate"],
                    cost: 0,
                    inkwell: false,
                    strength: 7,
                    willpower: 5,
                    lore: 1,
                }),
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Condition Three",
                    names: ["Condition Three"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Broom", "Hunny", "Puppy"],
                    cost: 0,
                    inkwell: false,
                    strength: 6,
                    willpower: 5,
                    lore: 1,
                }),
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Super Suit",
                    names: ["Super Suit"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Item Two",
                    names: ["Item Two"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Item Three",
                    names: ["Item Three"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Other Location",
                    names: ["Other Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 5,
                    lore: 1,
                    moveCost: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            prototypeCardName,
            prototypeCardName,
            prototypeCardName,
            prototypeCardName,
            prototypeCardName,
            prototypeCardName,
            prototypeCardName,
            prototypeCardName,
            prototypeCardName,
            prototypeCardName,
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 10 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Discarded Item",
                names: ["Discarded Item"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
            }),
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Opponent",
                    names: ["Opponent"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 1,
                    willpower: 5,
                    lore: 1,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        playerAt(scenarioGame, 1).play[1].location = source.card;
        inPlay(scenarioRules(), playerAt(scenarioGame, 1).play[1].card).under = [playerAt(scenarioGame, 1).hand[0]].map((card) => ({ card, faceDown: true }));
        const keywords = cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase());
        expect(keywords).toContainEqual("evasive");
    });
});
