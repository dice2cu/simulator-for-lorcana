import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/at-the-start-of-your-turn-you-may-put-the-top-card-of-your-d-64b51f9cc32b.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 64b51f9cc32b
const abilityText =
    "At the start of your turn, you may put the top card of your deck into your discard. If its card type is: • character, this character gets +2 ¤ this turn. • action or item, this character gets +2 ◊ this turn. • location, banish chosen character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Jack-Jack Parr - Incredible Potential",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Villain", "Dragon"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 6,
                    lore: 0,
                }),
                damage: 1,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const target = playerAt(scenarioGame, 2).play[0];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Milled Location",
                    names: ["Milled Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 5,
                    lore: 0,
                    moveCost: 0,
                }),
            ].reverse(),
        );
        const milled = [...playerAt(scenarioGame, 1).deck].reverse()[0];
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
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(milled);
        // Not a character, action or item
        expect(scenarioRules().characteristic(source.card, "Strength")).toBe(
            (() => {
                const definition = scenarioCards.definition(source.card.fullName);
                if (definition.type !== "Character") throw new Error("Expected a character");
                return definition.strength;
            })(),
        );
        expect(playerAt(scenarioGame, 2).discard).toContainEqual(target.card);
        expect(playerAt(scenarioGame, 2).play.map((entry) => entry.card)).not.toContainEqual(target.card);
    });
});
