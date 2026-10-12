import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/characters-can-t-be-challenged-while-here-b8b27b488e3d.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: b8b27b488e3d
const abilityText = "Characters can't be challenged while here.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Tiana's Palace - Jazz Restaurant",
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
                    cards: { zone: "Play", cardType: "Character", where: { at: "Self" } },
                    modifier: { restriction: "Can't Be Challenged" },
                },
                name: "NIGHT OUT",
            };
        playerAt(scenarioGame, 1).play[1].location = source.card;
        expect(scenarioRules().restricted(target.card, "Can't Be Challenged")).toBe(true);
    });
});
