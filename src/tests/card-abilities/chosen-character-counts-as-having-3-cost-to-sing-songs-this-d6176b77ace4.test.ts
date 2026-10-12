import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/chosen-character-counts-as-having-3-cost-to-sing-songs-this-d6176b77ace4.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
import type { Effect } from "../../model/ability";
// Generated ability ID: d6176b77ace4
const abilityText = "Chosen character counts as having +3 cost to sing songs this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Naveen's Ukulele",
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
                    fullName: "Singer",
                    names: ["Singer"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 1,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !true,
            },
        ]);
        const p = playerAt(scenarioGame, 1),
            [s, singer] = playerAt(scenarioGame, 1).play,
            a: Effect = printedEffect(scenarioCards.definition(s.card.fullName), 0);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Song",
                names: ["Song"],
                type: "Action",
                colors: ["Amber"],
                subtypes: ["Song"],
                cost: 4,
                playRules: [{ type: "Sing", cost: 4 }],
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        {
            const sourceDefinition = scenarioCards.definition(s.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                a,
                { card: s.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(1);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        const song = playerAt(scenarioGame, 1).hand[0],
            actions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(
            actions.some(
                (action) =>
                    action.type === "Sing" &&
                    sameCard(cardInAction(action), song) &&
                    "singers" in action &&
                    action.singers.some((singingCard) => sameCard(singingCard, singer.card)),
            ),
        ).toBe(true);
    });
});
