import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect, keywords as cardKeywords } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/your-floodborn-characters-gain-evasive-until-the-start-of-yo-b3002af9ab19.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: b3002af9ab19
const abilityText = "Your Floodborn characters gain Evasive until the start of your next turn. (Only characters with Evasive can challenge them.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Protective Aura",
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
                    fullName: "Matching",
                    names: ["Matching"],
                    type: "Character",
                    colors: ["Ruby", "Sapphire", "Emerald"],
                    subtypes: [
                        "Floodborn",
                        "Hero",
                        "Inventor",
                        "Illusion",
                        "Pirate",
                        "Prince",
                        "King",
                        "Princess",
                        "Queen",
                        "Puppy",
                        "Seven Dwarfs",
                        "Villain",
                    ],
                    abilities: [
                        { type: "Keyword", keyword: { name: "Evasive" } },
                        { type: "Keyword", keyword: { name: "Support" } },
                        { type: "Keyword", keyword: { name: "Reckless" } },
                        { type: "Keyword", keyword: { name: "Rush" } },
                    ],
                    cost: 0,
                    inkwell: false,
                    strength: 8,
                    willpower: 8,
                    lore: 1,
                }),
                damage: 1,
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Nonmatching",
                    names: ["Nonmatching"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 1,
                    willpower: 4,
                    lore: 1,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [source, matching, nonmatching] = playerAt(scenarioGame, 1).play;
        // Keep the nonmatching character in play, not also underneath another card.
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName));
        {
            {
                const sourceDefinition = scenarioCards.definition(source.card.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    ability,
                    { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
            }
        }
        expect(cardKeywords(scenarioRules(), matching.card).map((keyword) => keyword.toLowerCase())).toContainEqual("evasive");
        expect(cardKeywords(scenarioRules(), nonmatching.card).map((keyword) => keyword.toLowerCase())).not.toContainEqual("evasive");
    });
});
