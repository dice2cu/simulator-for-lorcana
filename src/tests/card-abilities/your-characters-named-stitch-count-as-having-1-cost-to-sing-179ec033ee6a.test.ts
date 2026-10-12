import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/your-characters-named-stitch-count-as-having-1-cost-to-sing-179ec033ee6a.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 179ec033ee6a
const abilityText = "Your characters named Stitch count as having +1 cost to sing songs.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Record Player",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Stitch",
                    names: ["Stitch"],
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
            {
                definition: scenarioCards.fixture({
                    fullName: "Other",
                    names: ["Other"],
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
                cost: 3,
                playRules: [{ type: "Sing", cost: 3 }],
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        const p = playerAt(scenarioGame, 1),
            song = playerAt(scenarioGame, 1).hand[0],
            stitch = playerAt(scenarioGame, 1).play[1],
            other = playerAt(scenarioGame, 1).play[2],
            actions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(scenarioRules().characteristic(stitch.card, "Cost To Sing")).toBe(3);
        expect(
            actions.some(
                (a) =>
                    a.type === "Sing" &&
                    sameCard(cardInAction(a), song) &&
                    "singers" in a &&
                    a.singers.some((singingCard) => sameCard(singingCard, stitch.card)),
            ),
        ).toBe(true);
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
