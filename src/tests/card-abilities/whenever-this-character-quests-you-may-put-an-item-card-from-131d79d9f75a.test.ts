import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-this-character-quests-you-may-put-an-item-card-from-131d79d9f75a.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 131d79d9f75a
const abilityText =
    "Whenever this character quests, you may put an item card from your discard on the bottom of your deck. If you do, you may play an item with cost 5 or less from your discard for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Darkwing Duck - Dashing Gadgeteer",
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
                    fullName: "Prerequisite",
                    names: ["Prerequisite"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Princess", "Seven Dwarfs", "Toy"],
                    cost: 2,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Bottom Card",
                names: ["Bottom Card"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 1,
                inkwell: false,
            }),
            scenarioCards.fixture({
                fullName: "Free Card",
                names: ["Free Card"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 5,
                inkwell: false,
            }),
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const bottomCard = playerAt(scenarioGame, 1).discard[0];
        const freeCard = playerAt(scenarioGame, 1).discard[1];
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
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                    })
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(4)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect([...playerAt(scenarioGame, 1).deck].reverse()[0]).toEqual(bottomCard);
        expect(playerAt(scenarioGame, 1).discard).not.toContainEqual(freeCard);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(freeCard);
    });
});
