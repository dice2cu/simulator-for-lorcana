import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/for-each-sorcerer-character-you-have-in-play-you-pay-1-less-b7f14c3dee95.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: b7f14c3dee95
const abilityText = "For each Sorcerer character you have in play, you pay 1 ⬡ less to play this action.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Seeking the Half Crown",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            ...Array.from({ length: 10 }, (_, index) => ({
                definition: scenarioCards.fixture({
                    fullName: "Condition " + index,
                    names: ["Condition " + index],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Alien", "Sorcerer", "Toy"],
                    cost: 0,
                    inkwell: false,
                    strength: 3,
                    willpower: 8,
                    lore: 1,
                }),
                damage: 2,
                exerted: !false,
            })),
            ...Array.from({ length: 10 }, (_, index) => ({
                definition: scenarioCards.fixture({
                    fullName: "Piggy Bank " + index,
                    names: ["The Nephews' Piggy Bank"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            })),
            ...Array.from({ length: 10 }, (_, index) => ({
                definition: scenarioCards.fixture({
                    fullName: "Location " + index,
                    names: ["Location " + index],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 5,
                    lore: 1,
                    moveCost: 0,
                }),
            })),
        ]);
        playerAt(scenarioGame, 2).play = cardStates(
            scenarioCards,
            Array.from({ length: 10 }, (_, index) => ({
                definition: scenarioCards.fixture({
                    fullName: "Condition " + index,
                    names: ["Condition " + index],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Alien", "Sorcerer", "Toy"],
                    cost: 0,
                    inkwell: false,
                    strength: 3,
                    willpower: 8,
                    lore: 1,
                }),
                damage: 2,
                exerted: !false,
            })),
        );
        playerAt(scenarioGame, 1).discard = cardIds(
            scenarioCards,
            Array.from({ length: 10 }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Discard " + index,
                    names: ["Discard " + index],
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
        );
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        const prototype = scenarioCards.definition(prototypeCardName);
        if (!prototype) throw new Error("Prototype card was not found.");
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: prototype.cost }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand.some((card) => card.fullName === prototypeCardName)).toBe(false);
    });
});
