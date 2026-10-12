import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/characters-count-as-having-2-cost-to-sing-songs-while-here-0a43b9c1c21c.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 0a43b9c1c21c
const abilityText = "Characters count as having +2 cost to sing songs while here.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Atlantica - Concert Hall",
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
                    fullName: "Singer",
                    names: ["Singer"],
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
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Song",
                names: ["Song"],
                type: "Action",
                colors: ["Amber"],
                subtypes: ["Song"],
                cost: 4,
                playRules: [{ type: "Sing", cost: 4 }],
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        const p = playerAt(scenarioGame, 1),
            location = playerAt(scenarioGame, 1).play[0],
            singer = playerAt(scenarioGame, 1).play[1],
            song = playerAt(scenarioGame, 1).hand[0];
        singer.location = location.card;
        const actions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(
            actions.some(
                (a) =>
                    a.type === "Sing" &&
                    sameCard(cardInAction(a), song) &&
                    "singers" in a &&
                    a.singers.some((singingCard) => sameCard(singingCard, singer.card)),
            ),
        ).toBe(true);
    });
});
