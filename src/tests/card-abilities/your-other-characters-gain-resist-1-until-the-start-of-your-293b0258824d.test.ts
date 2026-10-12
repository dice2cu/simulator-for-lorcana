import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect, keywords as cardKeywords } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/your-other-characters-gain-resist-1-until-the-start-of-your-293b0258824d.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 293b0258824d
const abilityText = "Your other characters gain Resist +1 until the start of your next turn. (Damage dealt to them is reduced by 1.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Kuzco - Selfish Emperor",
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
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
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
        const [source, matching] = playerAt(scenarioGame, 1).play;
        const [nonmatching] = playerAt(scenarioGame, 2).play;
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 1);
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
        expect(cardKeywords(scenarioRules(), matching.card).map((keyword) => keyword.toLowerCase())).toContainEqual("resist");
        expect(cardKeywords(scenarioRules(), nonmatching.card).map((keyword) => keyword.toLowerCase())).not.toContainEqual("resist");
    });
});
