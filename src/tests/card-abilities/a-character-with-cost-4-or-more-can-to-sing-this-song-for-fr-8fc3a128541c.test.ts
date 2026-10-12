import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/a-character-with-cost-4-or-more-can-to-sing-this-song-for-fr-8fc3a128541c.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 8fc3a128541c
const abilityText = "A character with cost 4 or more can ⟳ to sing this song for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "And Then Along Came Zeus",
    "Be King Undisputed",
    "Can't Hold It Back Anymore",
    "Colors of the Wind",
    "Education or Elimination",
    "Four Dozen Eggs",
    "Hakuna Matata",
    "He Hurled His Thunderbolt",
    "How Far I'll Go",
    "I Find 'Em, I Flatten 'Em",
    "Let's Get Dangerous",
    "Lost in the Woods",
    "Magnificent, Marvelous",
    "Marching Off to Battle",
    "Might Solve a Mystery",
    "Put That Thing Back",
    "Strange Things",
    "To Wither a Flower",
    "Try Everything",
    "We Could Be Immortals",
    "You're Welcome",
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
                    cost: 4,
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
                    cost: 3,
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
