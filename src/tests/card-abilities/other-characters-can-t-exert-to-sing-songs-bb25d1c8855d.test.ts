import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/other-characters-can-t-exert-to-sing-songs-bb25d1c8855d.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: bb25d1c8855d
const abilityText = "Other characters can't exert to sing songs.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Ursula - Sea Witch Queen",
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
                    fullName: "Other Singer",
                    names: ["Other Singer"],
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
            other = playerAt(scenarioGame, 1).play[1],
            actions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(
            actions.some(
                (a) =>
                    a.type === "Sing" &&
                    sameCard(cardInAction(a), song) &&
                    "singers" in a &&
                    a.singers.some((singingCard) => sameCard(singingCard, other.card)),
            ),
        ).toBe(false);
    });
});
