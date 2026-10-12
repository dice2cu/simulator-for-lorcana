import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/resist-1-damage-dealt-to-this-location-is-reduced-by-1-4dd21b0983a3.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 4dd21b0983a3
const abilityText = "Resist +1 (Damage dealt to this location is reduced by 1.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Royal Armory - Heavily Guarded",
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
        const player = playerAt(scenarioGame, 1);
        const location = playerAt(scenarioGame, 1).play[0];
        {
            const sourceDefinition = scenarioCards.definition(location.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Deal Damage", amount: 3, cards: { cards: [location.card] } },
                { card: location.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), location.card).damage ?? 0).toBe(2);
    });
});
