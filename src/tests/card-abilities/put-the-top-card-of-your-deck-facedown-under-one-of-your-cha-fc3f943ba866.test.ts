import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: fc3f943ba866
const abilityText = "Put the top card of your deck facedown under one of your characters or locations with Boost.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Lonely Grave",
    "Recovered Page",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("puts the top card facedown under the chosen Boost character", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                fullName: "Boost Target",
                names: ["Boost Target"],
                type: "Character" as const,
                colors: ["Amber" as const],
                subtypes: [],
                cost: 2,
                inkwell: false,
                strength: 1,
                willpower: 8,
                lore: 1,
                abilities: [{ type: "Keyword" as const, keyword: { name: "Boost" as const, cost: [{ type: "Ink" as const, amount: 1 }] } }],
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper"]);
        const [source, target] = playerAt(scenarioGame, 1).play.map((state) => state.card);
        const card = playerAt(scenarioGame, 1).deck[0];
        {
            const sourceDefinition = scenarioCards.definition(source.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                printedEffect(scenarioCards.definition(source.fullName), 0),
                { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
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
        expect(inPlay(scenarioRules(), target).under?.map((entry) => entry.card)).toContainEqual(card);
        expect(inPlay(scenarioRules(), target).under?.find((entry) => sameCard(entry.card, card))?.faceDown).toBe(true);
        expect(playerAt(scenarioGame, 1).deck).toEqual([]);
    });
});
