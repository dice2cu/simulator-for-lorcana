import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/each-player-pays-2-more-to-play-actions-or-items-this-doesn-5ded6d7f24e5.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 5ded6d7f24e5
const abilityText = "Each player pays 2 ⬡ more to play actions or items. (This doesn't apply to singing songs.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Gantu - Experienced Enforcer",
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
        const ownAction = scenarioCards.create(
            scenarioCards.fixture({
                fullName: "Own Action",
                names: ["Own Action"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 3,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        );
        const ownItem = scenarioCards.create(
            scenarioCards.fixture({
                fullName: "Own Item",
                names: ["Own Item"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 3,
                inkwell: false,
            }),
        );
        const ownCharacter = scenarioCards.create(
            scenarioCards.fixture({
                fullName: "Own Character",
                names: ["Own Character"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 3,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
        );
        const opposingAction = scenarioCards.create(
            scenarioCards.fixture({
                fullName: "Opposing Action",
                names: ["Opposing Action"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 3,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        );
        playerAt(scenarioGame, 1).hand.push(ownAction, ownItem, ownCharacter);
        playerAt(scenarioGame, 2).hand.push(opposingAction);
        expect(scenarioRules().cost(ownAction)).toBe(5);
        expect(scenarioRules().cost(ownItem)).toBe(5);
        expect(scenarioRules().cost(ownCharacter)).toBe(3);
        expect(scenarioRules().cost(opposingAction)).toBe(5);
    });
});
