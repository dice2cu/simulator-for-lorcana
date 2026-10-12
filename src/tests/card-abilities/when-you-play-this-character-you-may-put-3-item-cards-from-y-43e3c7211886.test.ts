import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-you-play-this-character-you-may-put-3-item-cards-from-y-43e3c7211886.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 43e3c7211886
const abilityText =
    "When you play this character, you may put 3 item cards from your discard on the bottom of your deck in any order. If you do, deal 3 damage to chosen character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Stegmutt - Clumsy Dinosaur",
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
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 9,
                    lore: 1,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const target = playerAt(scenarioGame, 2).play[0];
        playerAt(scenarioGame, 1).discard = cardIds(
            scenarioCards,
            Array.from({ length: 3 }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Item " + index,
                    names: ["Item " + index],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            ),
        );
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
                        expect(request.min).toBe(3);
                        expect(request.max).toBe(3);
                        return {
                            type: "Decision",
                            answer: { type: "Choose Cards", cards: [scenarioCards.instance(3), scenarioCards.instance(4), scenarioCards.instance(5)] },
                        };
                    })
                    .on("Order Cards", (request) => {
                        expect(request.cards).toHaveLength(3);
                        return {
                            type: "Decision",
                            answer: { type: "Order Cards", cards: [scenarioCards.instance(3), scenarioCards.instance(4), scenarioCards.instance(5)] },
                        };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).discard.length).toBe(0);
        expect(inPlay(scenarioRules(), target.card).damage ?? 0).toBe(3);
    });
});
