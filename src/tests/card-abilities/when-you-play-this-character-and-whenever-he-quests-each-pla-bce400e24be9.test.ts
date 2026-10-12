import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-you-play-this-character-and-whenever-he-quests-each-pla-bce400e24be9.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: bce400e24be9
const abilityText =
    "When you play this character and whenever he quests, each player reveals the top card of their deck. If it's a character card, they may put it into their hand. Otherwise, put it on the bottom of their deck.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mike Wazowski - Heroic Climber",
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
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Optional", (request) => {
                    return { type: "Decision", answer: { type: "Optional", accept: true } };
                }),
                2: new ScriptedPlayer().on("Optional", (request) => {
                    return { type: "Decision", answer: { type: "Optional", accept: true } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(ownCard);
        expect(playerAt(scenarioGame, 2).hand).toContainEqual(opposingCard);
    });
});
