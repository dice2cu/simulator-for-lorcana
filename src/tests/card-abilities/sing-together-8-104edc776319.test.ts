import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 104edc776319
const abilityText = "Sing Together 8";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Circle of Life",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("allows enough combined singing cost but not an insufficient pair", () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const definition = scenarioCards.definition(prototypeCardName);
        const rule = definition.playRules?.find((rule) => rule.type === "Sing Together");
        if (!rule || rule.type !== "Sing Together") throw new Error("Expected Sing Together");
        const printedAmount = /Sing Together ([0-9]+)/.exec(abilityText)?.[1];
        if (!printedAmount) throw new Error("Expected the numeric keyword in the effect text");
        expect(rule.cost).toBe(Number(printedAmount));
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(
            scenarioCards,
            [Math.floor(rule.cost / 2), Math.ceil(rule.cost / 2), 1].map((cost, index) =>
                scenarioCards.fixture({
                    fullName: "Singer " + index,
                    names: ["Singer " + index],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost,
                    inkwell: false,
                    strength: 1,
                    willpower: 5,
                    lore: 1,
                }),
            ),
        );
        const song = playerAt(scenarioGame, 1).hand[0];
        const [one, two, small] = playerAt(scenarioGame, 1).play.map((state) => state.card);
        const actions = (1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).filter(
            (action) => action.type === "Sing" && sameCard(action.song, song),
        );
        expect(actions).toContainEqual(expect.objectContaining({ singers: [one, two] }));
        expect(
            actions.some(
                (action) =>
                    action.type === "Sing" &&
                    action.singers.length === 2 &&
                    action.singers.some((singer) => sameCard(singer, small)) &&
                    action.singers.some((singer) => sameCard(singer, one)),
            ),
        ).toBe(false);
        // Sing Together permits overpaying. The low-cost singer may join an already sufficient group.
        expect(actions).toContainEqual(expect.objectContaining({ singers: [one, two, small] }));
    });
});
