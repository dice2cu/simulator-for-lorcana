import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/once-during-your-turn-whenever-this-character-sings-a-song-l-2b73585328a9.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 2b73585328a9
const abilityText =
    "Once during your turn, whenever this character sings a song, look at the top 4 cards of your deck. You may reveal a song card with cost 9 or less and play it for free. Put the rest on the bottom of your deck in any order.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Powerline - World's Greatest Rock Star",
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
                    fullName: "Other 1",
                    names: ["Other 1"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                scenarioCards.fixture({
                    fullName: "Other 2",
                    names: ["Other 2"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                scenarioCards.fixture({
                    fullName: "Other 3",
                    names: ["Other 3"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                scenarioCards.fixture({
                    fullName: "Song",
                    names: ["Song"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: ["Song"],
                    cost: 3,
                    playRules: [{ type: "Sing", cost: 3 }],
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ].reverse(),
        );
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            song = [...playerAt(scenarioGame, 1).deck].reverse()[[...playerAt(scenarioGame, 1).deck].reverse().length - 1],
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 2);
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
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    })
                    .on("Order Cards", (request) => {
                        expect(request.cards).toHaveLength(3);
                        return {
                            type: "Decision",
                            answer: { type: "Order Cards", cards: [scenarioCards.instance(3), scenarioCards.instance(4), scenarioCards.instance(5)] },
                        };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(song);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toHaveLength(3);
    });
});
