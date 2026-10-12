import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/each-player-shuffles-their-deck-and-then-reveals-the-top-car-b2ceaa8f8515.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: b2ceaa8f8515
const abilityText =
    "Each player shuffles their deck and then reveals the top card. Each player who reveals a character card may play that character for free. Otherwise, put the revealed cards on the bottom of their player's deck.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Let's Get Dangerous",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Own Character",
                    names: ["Own Character"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            ].reverse(),
        );
        playerAt(scenarioGame, 2).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Opposing Character",
                    names: ["Opposing Character"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            ].reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const ownCard = [...playerAt(scenarioGame, 1).deck].reverse()[0];
        const opposingCard = [...playerAt(scenarioGame, 2).deck].reverse()[0];
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
                    1: new ScriptedPlayer().on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    }),
                    2: new ScriptedPlayer().on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    }),
                },
                {
                    random: [
                        { type: "Shuffle", cards: [scenarioCards.instance(2)] },
                        { type: "Shuffle", cards: [scenarioCards.instance(3)] },
                    ],
                },
            );
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(ownCard);
        expect(playerAt(scenarioGame, 2).play.map((entry) => entry.card)).toContainEqual(opposingCard);
    });
});
