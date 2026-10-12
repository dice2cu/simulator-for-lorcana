import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-this-character-quests-you-may-choose-and-discard-an-7d016d961214.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 7d016d961214
const abilityText = "Whenever this character quests, you may choose and discard any number of item cards to gain 1 lore for each item card discarded this way.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Geppetto - Skilled Craftsman",
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
                fullName: "Item One",
                names: ["Item One"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
            }),
            scenarioCards.fixture({
                fullName: "Item Two",
                names: ["Item Two"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
            }),
            scenarioCards.fixture({
                fullName: "Not Item",
                names: ["Not Item"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const items = playerAt(scenarioGame, 1).hand.filter((card) => scenarioCards.definition(card.fullName).type === "Item");
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0); /* "you may": yes */
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
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(2);
        expect(playerAt(scenarioGame, 1).discard).toEqual(expect.arrayContaining(items));
    });
});
