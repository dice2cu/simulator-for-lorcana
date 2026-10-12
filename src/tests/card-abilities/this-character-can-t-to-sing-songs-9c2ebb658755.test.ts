import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/this-character-can-t-to-sing-songs-9c2ebb658755.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 9c2ebb658755
const abilityText = "This character can't ⟳ to sing songs.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Ariel - On Human Legs",
    "Ulf - Mime",
    "Dopey - Drawn to Music",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Song",
                names: ["Song"],
                type: "Action",
                colors: ["Amber"],
                subtypes: ["Song"],
                cost: 1,
                playRules: [{ type: "Sing", cost: 1 }],
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        const p = playerAt(scenarioGame, 1),
            song = playerAt(scenarioGame, 1).hand[0],
            s = playerAt(scenarioGame, 1).play[0],
            actions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(
            actions.some(
                (a) => a.type === "Sing" && sameCard(cardInAction(a), song) && "singers" in a && a.singers.some((singingCard) => sameCard(singingCard, s.card)),
            ),
        ).toBe(false);
    });
});
