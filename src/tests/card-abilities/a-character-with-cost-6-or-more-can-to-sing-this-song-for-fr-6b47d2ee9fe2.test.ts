import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/a-character-with-cost-6-or-more-can-to-sing-this-song-for-fr-6b47d2ee9fe2.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 6b47d2ee9fe2
const abilityText = "A character with cost 6 or more can ⟳ to sing this song for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Blast from Your Past",
    "Down in New Orleans",
    "Higitus Figitus",
    "Treasures Untold",
    "Trust In Me",
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
                    cost: 6,
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
                    cost: 5,
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
