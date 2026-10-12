import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect, keywords as cardKeywords } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-this-character-quests-another-chosen-character-of-y-4d7e271318ff.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 4d7e271318ff
const abilityText = "Whenever this character quests, another chosen character of yours gets +1 ◊ and gains Ward until the start of your next turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Alice - Savvy Sailor",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Chosen Target",
                    names: ["Chosen Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Hero", "Villain", "Hunny", "Puppy", "Detective"],
                    cost: 0,
                    inkwell: false,
                    strength: 10,
                    willpower: 8,
                    lore: 1,
                }),
                damage: 1,
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 1).play[1],
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 1);
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
                    expect(request.min).toBe(1);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        const keywords = cardKeywords(scenarioRules(), target.card).map((keyword) => keyword.toLowerCase());
        expect(scenarioRules().characteristic(target.card, "Lore")).toBe((scenarioRules().characteristic(target.card, "Lore", true) ?? 0) + 1);
        expect(keywords).toContainEqual("ward");
    });
});
