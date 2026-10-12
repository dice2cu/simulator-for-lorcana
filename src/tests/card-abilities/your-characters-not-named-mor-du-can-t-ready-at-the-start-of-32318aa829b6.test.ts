import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/your-characters-not-named-mor-du-can-t-ready-at-the-start-of-32318aa829b6.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 32318aa829b6
const abilityText = "Your characters not named Mor'du can't ready at the start of your turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mor'du - Savage Cursed Prince",
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
                    fullName: "Protected",
                    names: ["Protected"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Hero", "Villain"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 2,
                    lore: 0,
                }),
                damage: 1,
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
                    cards: { zone: "Play", player: "You", cardType: "Character", where: { not: { name: "Mor'du" } } },
                    modifier: { restriction: "Can't Ready At Start Of Turn" },
                },
                name: "ROOTED BY FEAR",
            };
        expect(scenarioRules().restricted(target.card, "Can't Ready At Start Of Turn")).toBe(true);
    });
});
