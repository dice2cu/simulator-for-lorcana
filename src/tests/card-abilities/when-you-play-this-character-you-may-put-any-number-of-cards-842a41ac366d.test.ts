import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-you-play-this-character-you-may-put-any-number-of-cards-842a41ac366d.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 842a41ac366d
const abilityText =
    "When you play this character, you may put any number of cards from your hand on the bottom of your deck in any order. If you do, draw that number of cards plus 1.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Aladdin & Genie - Mischievous Pals",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Returned One",
                names: ["Returned One"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
            scenarioCards.fixture({
                fullName: "Returned Two",
                names: ["Returned Two"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
            }),
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Draw One",
                    names: ["Draw One"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                scenarioCards.fixture({
                    fullName: "Draw Two",
                    names: ["Draw Two"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                scenarioCards.fixture({
                    fullName: "Draw Three",
                    names: ["Draw Three"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ].reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const returned = [...playerAt(scenarioGame, 1).hand];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 1);
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(2);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2), scenarioCards.instance(3)] } };
                    })
                    .on("Order Cards", (request) => {
                        expect(request.cards).toHaveLength(2);
                        return { type: "Decision", answer: { type: "Order Cards", cards: [scenarioCards.instance(2), scenarioCards.instance(3)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(3);
        expect(
            returned.every((card) => [...playerAt(scenarioGame, 1).deck].reverse().some((other) => other.fullName === card.fullName && other.i === card.i)),
        ).toBe(true);
    });
});
