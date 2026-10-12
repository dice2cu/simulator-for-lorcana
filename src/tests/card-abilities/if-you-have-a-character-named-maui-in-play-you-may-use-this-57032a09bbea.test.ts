import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/if-you-have-a-character-named-maui-in-play-you-may-use-this-57032a09bbea.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 57032a09bbea
const abilityText = "If you have a character named Maui in play, you may use this item's Shapeshift ability for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Maui's Fish Hook",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Maui - Hero to All",
                    names: ["Maui"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const shapeshiftIndex =
            scenarioCards.definition(source.card.fullName).abilities?.findIndex(
                (effect) =>
                    (
                        effect as {
                            type?: string;
                        }
                    ).type === "Activated",
            ) ?? -1;
        const actions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(shapeshiftIndex).toBeGreaterThanOrEqual(0);
        expect(actions).toContainEqual(expect.objectContaining({ type: "Activate", ability: { card: source.card, i: shapeshiftIndex }, free: true }));
    });
});
