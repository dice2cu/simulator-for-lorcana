import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-this-character-challenges-a-damaged-character-she-t-ae8ce58cda57.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: ae8ce58cda57
const abilityText = "Whenever this character challenges a damaged character, she takes no damage from the challenge.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Raya - Leader of Heart",
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
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Damaged Opponent",
                    names: ["Damaged Opponent"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 4,
                    willpower: 10,
                    lore: 0,
                }),
                damage: 1,
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const opposingCharacter = playerAt(scenarioGame, 2).play[0];
        source.exerted = !true;
        source.drying = false;
        const result = await (async () => {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source.card, defender: opposingCharacter.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
            return true;
        })();
        expect(result).toBe(true);
        expect(inPlay(scenarioRules(), source.card).damage ?? 0).toBe(0);
    });
});
