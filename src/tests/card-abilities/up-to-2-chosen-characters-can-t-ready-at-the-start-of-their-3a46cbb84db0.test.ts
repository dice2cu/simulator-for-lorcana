import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/up-to-2-chosen-characters-can-t-ready-at-the-start-of-their-3a46cbb84db0.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 3a46cbb84db0
const abilityText = "Up to 2 chosen characters can't ready at the start of their next turn. Draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "They Never Come Back",
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
                    strength: 5,
                    willpower: 8,
                    lore: 1,
                }),
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, [prototypeCardName].reverse());
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const target = playerAt(scenarioGame, 2).play[0];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName));
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(0);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(scenarioRules().restricted(target.card, "Can't Ready At Start Of Turn")).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(1);
    });
    it("draws one card however many characters are chosen", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Mickey Mouse - True Friend", "Mickey Mouse - True Friend"]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, [prototypeCardName, prototypeCardName]);
        const source = playerAt(scenarioGame, 1).play[0];
        const [first, second] = playerAt(scenarioGame, 2).play;
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                printedEffect(scenarioCards.definition(source.card.fullName)),
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(0);
                    expect(request.max).toBe(2);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2), scenarioCards.instance(3)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(scenarioRules().restricted(first.card, "Can't Ready At Start Of Turn")).toBe(true);
        expect(scenarioRules().restricted(second.card, "Can't Ready At Start Of Turn")).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(1);
    });
});
