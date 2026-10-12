import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/your-other-illusion-characters-gain-challenger-1-they-get-1-0a2e6a7d52ba.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 0a2e6a7d52ba
const abilityText = "Your other Illusion characters gain Challenger +1. (They get +1 ¤ while challenging.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Magic Carpet - Phantom Rug",
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
                    fullName: "Matching",
                    names: ["Matching"],
                    type: "Character",
                    colors: ["Ruby", "Sapphire", "Emerald"],
                    subtypes: [
                        "Floodborn",
                        "Hero",
                        "Inventor",
                        "Illusion",
                        "Pirate",
                        "Prince",
                        "King",
                        "Princess",
                        "Queen",
                        "Puppy",
                        "Seven Dwarfs",
                        "Villain",
                    ],
                    abilities: [
                        { type: "Keyword", keyword: { name: "Evasive" } },
                        { type: "Keyword", keyword: { name: "Support" } },
                        { type: "Keyword", keyword: { name: "Reckless" } },
                        { type: "Keyword", keyword: { name: "Rush" } },
                    ],
                    cost: 0,
                    inkwell: false,
                    strength: 8,
                    willpower: 8,
                    lore: 1,
                }),
                damage: 1,
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Nonmatching",
                    names: ["Nonmatching"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 1,
                    willpower: 4,
                    lore: 1,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [source, matching, nonmatching] = playerAt(scenarioGame, 1).play;
        inPlay(scenarioRules(), matching.card).under = [nonmatching.card].map((card) => ({ card, faceDown: true }));
        const ability: Ability = {
            type: "Static",
            rule: {
                type: "Modify Cards",
                cards: { zone: "Play", player: "You", cardType: "Character", where: { classification: "Illusion" }, exclude: "Self" },
                modifier: { gainKeyword: "Challenger", amount: 1 },
            },
            name: "SPECTRAL FORCE",
        };
        expect(cardKeywords(scenarioRules(), matching.card).map((keyword) => keyword.toLowerCase())).toContainEqual("challenger");
        expect(cardKeywords(scenarioRules(), nonmatching.card).map((keyword) => keyword.toLowerCase())).not.toContainEqual("challenger");
    });
});
