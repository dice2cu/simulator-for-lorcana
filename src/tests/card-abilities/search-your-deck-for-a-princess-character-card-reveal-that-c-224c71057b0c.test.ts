import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/search-your-deck-for-a-princess-character-card-reveal-that-c-224c71057b0c.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 224c71057b0c
const abilityText =
    "Search your deck for a Princess character card, reveal that card to all players, and put it into your hand. Then, shuffle your deck. If you have 2 or more Seven Dwarfs characters in play, draw 2 cards and gain 2 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Don't Be Nervous",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Dwarf One",
                    names: ["Dwarf One"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Seven Dwarfs"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Dwarf Two",
                    names: ["Dwarf Two"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Seven Dwarfs"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                prototypeCardName,
                prototypeCardName,
                scenarioCards.fixture({
                    fullName: "Found",
                    names: ["Found"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Princess"],
                    cost: 2,
                    inkwell: false,
                    strength: 0,
                    willpower: 5,
                    lore: 1,
                }),
            ].reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const foundCard = [...playerAt(scenarioGame, 1).deck].reverse()[2];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName));
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(
                scenarioResolution,
                {
                    1: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [request.cards[0]] } };
                    }),
                },
                {
                    random: [{ type: "Shuffle", cards: [scenarioCards.instance(6), scenarioCards.instance(5)] }],
                },
            );
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(3);
        expect(playerAt(scenarioGame, 1).lore).toBe(2);
    });
});
