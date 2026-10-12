import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/resist-3-damage-dealt-to-this-character-is-reduced-by-3-b6d9e51aada7.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: b6d9e51aada7
const abilityText = "Resist +3 (Damage dealt to this character is reduced by 3.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Namaari - Resolute Daughter",
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
        const character = playerAt(scenarioGame, 1).play[0];
        {
            const sourceDefinition = scenarioCards.definition(character.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Deal Damage", amount: 5, cards: { cards: [character.card] } },
                { card: character.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), character.card).damage ?? 0).toBe(2);
    });
});
