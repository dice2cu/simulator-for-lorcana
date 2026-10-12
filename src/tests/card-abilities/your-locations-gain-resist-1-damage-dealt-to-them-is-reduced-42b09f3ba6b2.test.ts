import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/your-locations-gain-resist-1-damage-dealt-to-them-is-reduced-42b09f3ba6b2.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 42b09f3ba6b2
const abilityText = "Your locations gain Resist +1. (Damage dealt to them is reduced by 1.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Fat Cat - Criminal Businessman",
    "Launchpad - Hideout Defender",
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
                    fullName: "Owned Location",
                    names: ["Owned Location", "Magic Broom", "Robin Hood", "Stitch"],
                    type: "Location",
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
                    willpower: 5,
                    lore: 1,
                    moveCost: 0,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 1).play[1],
            ability: Ability = {
                type: "Static",
                rule: { type: "Modify Cards", cards: { zone: "Play", player: "You", cardType: "Location" }, modifier: { gainKeyword: "Resist", amount: 1 } },
                name: "WORTHY INVESTMENT",
            };
        target.location = source.card;
        const keywords = cardKeywords(scenarioRules(), target.card).map((x) => x.toLowerCase());
        expect(keywords).toContainEqual("resist");
    });
});
