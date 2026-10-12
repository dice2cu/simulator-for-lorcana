import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect, isExerted } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/ready-chosen-character-of-yours-they-can-t-quest-for-the-res-63201dbde305.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 63201dbde305
const abilityText = "Ready chosen character of yours. They can't quest for the rest of this turn. If a Villain character is chosen, gain 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Evil Comes Prepared",
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
                    fullName: "Mulan",
                    names: ["Mulan"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Villain"],
                    cost: 0,
                    inkwell: false,
                    strength: 3,
                    willpower: 5,
                    lore: 2,
                }),
                damage: 1,
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Other",
                    names: ["Other"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 4,
                    lore: 1,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const target = playerAt(scenarioGame, 1).play[1];
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
                    expect(request.min).toBe(1);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(!isExerted(scenarioRules(), target.card)).toBe(true);
        expect(playerAt(scenarioGame, 1).lore).toBe(1);
    });
});
