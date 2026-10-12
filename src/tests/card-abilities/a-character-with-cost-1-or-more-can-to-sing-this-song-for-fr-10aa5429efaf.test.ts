import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/a-character-with-cost-1-or-more-can-to-sing-this-song-for-fr-10aa5429efaf.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 10aa5429efaf
const abilityText = "A character with cost 1 or more can ⟳ to sing this song for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "A Very Merry Unbirthday",
    "But I'm Much Faster",
    "He's a Tramp",
    "I Will Find My Way",
    "It Calls Me",
    "Reflection",
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
                    cost: 1,
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
        const singer = playerAt(scenarioGame, 1).play[0];
        const actions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(actions).toContainEqual(expect.objectContaining({ type: "Sing", song: song, singers: [singer.card] }));
    });
});
