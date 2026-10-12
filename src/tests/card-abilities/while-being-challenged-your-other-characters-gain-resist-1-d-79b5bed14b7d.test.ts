import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/while-being-challenged-your-other-characters-gain-resist-1-d-79b5bed14b7d.test.ts
import { describe, expect, it } from "vitest";
import { Rules } from "../../engine/rules";
import type { Ability } from "../../model/ability";
// Generated ability ID: 79b5bed14b7d
const abilityText = "While being challenged, your other characters gain Resist +1. (Damage dealt to them is reduced by 1.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Captain Amelia - Commander of the Legacy",
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
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Detective", "Musketeer", "Pirate", "Hero", "Villain", "Seven Dwarfs", "Hunny", "Racer", "Toy"],
                    cost: 0,
                    inkwell: false,
                    strength: 3,
                    willpower: 6,
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
                    type: "Conditional",
                    if: { inChallenge: "Self", role: "Defender" },
                    then: {
                        type: "Modify Cards",
                        cards: { zone: "Play", player: "You", cardType: "Character", exclude: "Self" },
                        modifier: { gainKeyword: "Resist", amount: 1 },
                    },
                },
                name: "EVERYTHING SHIPSHAPE",
            };
        const attacker = (() => {
            const card = scenarioCards.create(scenarioCards.definition("Mickey Mouse - True Friend"));
            playerAt(scenarioGame, 2).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        const rules = new Rules(scenarioRules().position, (name) => scenarioCards.definition(name), {
            challenge: { attacker, defender: source.card },
        });
        const keywords = rules.keyword(target.card, "Resist") ? ["resist"] : [];
        expect(keywords).toContainEqual("resist");
    });
});
