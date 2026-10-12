import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-one-of-your-ally-characters-quests-you-may-remove-u-fddd35ca113b.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: fddd35ca113b
const abilityText = "Whenever one of your Ally characters quests, you may remove up to 2 damage from this character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Aladdin - Vigilant Guard",
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
                    fullName: "Aladdin - Vigilant Guard",
                    names: ["Aladdin"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Dreamborn", "Hero", "Prince"],
                    cost: 6,
                    inkwell: true,
                    strength: 1,
                    willpower: 9,
                    lore: 1,
                }),
                damage: 4,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Damaged Target",
                    names: ["Damaged Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Puppy", "Musketeer"],
                    abilities: [{ type: "Keyword", keyword: { name: "Bodyguard" } }],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                }),
                damage: 4,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [source, target] = playerAt(scenarioGame, 1).play;
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 1);
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
                    .on("Choose Amount", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(2);
                        return { type: "Decision", answer: { type: "Choose Amount", amount: 2 } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        // "from this character"
        expect(inPlay(scenarioRules(), source.card).damage ?? 0).toBe(2);
    });
});
