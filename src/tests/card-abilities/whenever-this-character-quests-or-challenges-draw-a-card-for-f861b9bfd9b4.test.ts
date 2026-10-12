import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-this-character-quests-or-challenges-draw-a-card-for-f861b9bfd9b4.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: f861b9bfd9b4
const abilityText = "Whenever this character quests or challenges, draw a card for each card under them.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Dash Parr & Violet Parr - Super Siblings",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 2])("draws the exact number counted by the effect (%s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).discard = cardIds(
            scenarioCards,
            Array.from({ length: count }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Under " + index,
                    names: ["Under " + index],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ),
        );
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 5 }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Draw " + index,
                    names: ["Draw " + index],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ).reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const deck = [...[...playerAt(scenarioGame, 1).deck].reverse()];
        inPlay(scenarioRules(), source.card).under = [...player.discard].map((card) => ({ card, faceDown: true }));
        playerAt(scenarioGame, 1).discard = [];
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        const amount = count;
        expect(playerAt(scenarioGame, 1).hand).toEqual(amount === 0 ? [] : deck.slice(-amount).reverse());
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(deck.slice(0, deck.length - amount));
    });
});
