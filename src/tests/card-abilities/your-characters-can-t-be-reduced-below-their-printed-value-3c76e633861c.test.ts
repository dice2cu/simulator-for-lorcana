import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { describe, expect, it } from "vitest";
// Generated ability ID: 3c76e633861c
const abilityText = "Your characters' ¤ can't be reduced below their printed value.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Elisa Maza - Transformed Gargoyle",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("does not reduce friendly strength below the printed value", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                fullName: "Ally",
                names: ["Ally"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 4,
                willpower: 4,
                lore: 1,
            },
        ]);
        const [source, ally] = playerAt(scenarioGame, 1).play.map((state) => state.card);
        {
            const sourceDefinition = scenarioCards.definition(source.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                {
                    type: "Modify Cards",
                    cards: { cards: [ally] },
                    modifier: { stat: "Strength", amount: -5 },
                    duration: { until: "End Of Turn" },
                },
                { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(scenarioRules().characteristic(ally, "Strength")).toBe(4);
    });
});
