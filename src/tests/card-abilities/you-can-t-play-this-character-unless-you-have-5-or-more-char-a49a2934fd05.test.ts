import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/you-can-t-play-this-character-unless-you-have-5-or-more-char-a49a2934fd05.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: a49a2934fd05
const abilityText = "You can't play this character unless you have 5 or more characters in play.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mirabel Madrigal - Family Gatherer",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(
            scenarioCards,
            Array.from({ length: 4 }, (_, index) => ({
                definition: scenarioCards.fixture({
                    fullName: `Character ${index}`,
                    names: [`Character ${index}`],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            })),
        );
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 20 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).hand[0];
        const canPlay = () =>
            (1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).some(
                (action) => action.type === "Play" && sameCard(cardInAction(action), source),
            );
        expect(canPlay()).toBe(false);
        playerAt(scenarioGame, 1).play.push({
            card: scenarioCards.create(
                scenarioCards.fixture({
                    fullName: "Fifth Character",
                    names: ["Fifth Character"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            ),
        });
        expect(canPlay()).toBe(true);
    });
});
