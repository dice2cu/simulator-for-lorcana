import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-this-character-quests-if-there-s-a-card-under-her-r-fb31efed801f.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: fb31efed801f
const abilityText = "Whenever this character quests, if there's a card under her, remove up to 3 damage from each of your characters.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Jasmine - Soothing Princess",
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
                damage: 5,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [source, target] = playerAt(scenarioGame, 1).play;
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 1);
        inPlay(scenarioRules(), source.card).under = [
            scenarioCards.create(
                scenarioCards.fixture({
                    fullName: "Under Card",
                    names: ["Under Card"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ),
        ].map((card) => ({ card, faceDown: true }));
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
                    .on("Choose Amount", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(0);
                        return { type: "Decision", answer: { type: "Choose Amount", amount: 0 } };
                    })
                    .on("Choose Amount", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(3);
                        return { type: "Decision", answer: { type: "Choose Amount", amount: 3 } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), target.card).damage ?? 0).toBe(2);
    });
});
