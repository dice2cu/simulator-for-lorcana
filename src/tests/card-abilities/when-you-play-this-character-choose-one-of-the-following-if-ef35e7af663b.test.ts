import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-you-play-this-character-choose-one-of-the-following-if-ef35e7af663b.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: ef35e7af663b
const abilityText =
    "When you play this character, choose one of the following. If you have another Toy character in play, choose both instead: • You may return a character card with cost 2 or less from your discard to your hand. • You may play a character with cost 2 or less for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Woody - Helping a Friend",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).discard = cardIds(
            scenarioCards,
            Array.from({ length: 1 }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Discard Target " + index,
                    names: ["Discard Target " + index],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 2,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            ),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const targets = [...playerAt(scenarioGame, 1).discard];
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
                1: new ScriptedPlayer()
                    .on("Choose Mode", (request) => {
                        expect(request.options).toHaveLength(2);
                        return { type: "Decision", answer: { type: "Choose Mode", mode: 0 } };
                    })
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(targets[0]);
        expect(playerAt(scenarioGame, 1).discard).not.toContainEqual(targets[0]);
    });
});
