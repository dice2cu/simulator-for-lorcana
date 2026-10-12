import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect, isExerted } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/once-during-your-turn-whenever-you-play-another-character-yo-0d2d3fa58aac.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 0d2d3fa58aac
const abilityText =
    "Once during your turn, whenever you play another character, you may ready this character. He can't quest or challenge for the rest of this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mr. Litwak - Arcade Owner",
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
            {
                definition: scenarioCards.fixture({
                    fullName: "Mr. Litwak - Arcade Owner",
                    names: ["Mr. Litwak"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn"],
                    cost: 3,
                    inkwell: true,
                    strength: 2,
                    willpower: 3,
                    lore: 1,
                }),
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Singer",
                    names: ["Singer"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = source,
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0); /* "you may": yes */
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Optional", (request) => {
                    return { type: "Decision", answer: { type: "Optional", accept: true } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(!isExerted(scenarioRules(), target.card)).toBe(true);
    });
});
