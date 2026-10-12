import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/a-character-with-cost-3-or-more-can-to-sing-this-song-for-fr-8ed07141fa1f.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 8ed07141fa1f
const abilityText = "A character with cost 3 or more can ⟳ to sing this song for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Akood et Emuti",
    "Bibbidi Bobbidi Boo",
    "Do You Want to Build A Snowman?",
    "Fragile as a Flower",
    "Friends on the Other Side",
    "Gruesome and Grim",
    "Heal What Has Been Hurt",
    "I'm Still Here",
    "If I Didn't Have You",
    "Into the Unknown",
    "Let the Storm Rage On",
    "Malicious, Mean, and Scary",
    "Mother Knows Best",
    "One Last Hope",
    "Or Rewrite History!",
    "Part of Your World",
    "Someone Will Lose His Head",
    "Stand Out",
    "Strength of a Raging Fire",
    "The Boss is on a Roll",
    "The Cold Never Bothered Me",
    "The Islands I Pulled from the Sea",
    "The Islands I Pulled From the Sea",
    "The Most Diabolical Scheme",
    "This Growing Pressure",
    "We Know the Way",
    "We've Got a Lot to Do!",
    "When Will My Life Begin?",
    "When You Need Help, Just Call",
    "World's Greatest Criminal Mind",
    "You've Got a Friend in Me",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Eligible Singer",
                    names: ["Eligible Singer"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 3,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !true,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Ineligible Singer",
                    names: ["Ineligible Singer"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 2,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !true,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const song = playerAt(scenarioGame, 1).hand[0];
        const [eligible, ineligible] = playerAt(scenarioGame, 1).play;
        const actions = (1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).filter(
            (action) => action.type === "Sing" && sameCard(cardInAction(action), song),
        );
        expect(actions.some((action) => "singers" in action && action.singers.some((singingCard) => sameCard(singingCard, eligible.card)))).toBe(true);
        expect(actions.some((action) => "singers" in action && action.singers.some((singingCard) => sameCard(singingCard, ineligible.card)))).toBe(false);
    });
});
