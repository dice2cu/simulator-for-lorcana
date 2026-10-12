import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/if-you-have-6-or-less-put-the-top-3-cards-of-your-deck-into-e7653b4e96b0.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: e7653b4e96b0
const abilityText = "If you have 6 ⬡ or less, put the top 3 cards of your deck into your inkwell facedown.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Capsize",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 6 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 3 }, (_, i) =>
                scenarioCards.fixture({
                    fullName: "Top " + i,
                    names: ["Top " + i],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ).reverse(),
        );
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            cards = [...[...playerAt(scenarioGame, 1).deck].reverse()],
            ability: Effect = {
                type: "Conditional",
                if: { value: { count: { zone: "Inkwell", player: "You" } }, is: { atMost: 6 } },
                then: { type: "Move Card", cards: { zone: "Deck", player: "You", position: "Top", take: 3 }, to: "Inkwell" },
            };
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).inkwell.map((ink) => ink.card)).toEqual(expect.arrayContaining(cards));
    });
});
