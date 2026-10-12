import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { canChallenge } from "../../engine/actions";
// Converted from reference/card-abilities/bodyguard-an-opposing-character-who-challenges-one-of-your-c-b1c741984691.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: b1c741984691
const abilityText = "Bodyguard (An opposing character who challenges one of your characters must choose one with Bodyguard if able.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Flotsam - Wicked Defender",
    "Prince Eric - Grim Groom",
    "Hercules - Manipulated Hero",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            { definition: prototypeCardName, exerted: !false },
            { definition: "Stitch - Rock Star", exerted: !false },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [{ definition: "HeiHei - Boat Snack", exerted: !true }]);
        const attacker = playerAt(scenarioGame, 2).play[0];
        const [bodyguard, ordinaryTarget] = playerAt(scenarioGame, 1).play;
        expect(canChallenge(scenarioRules(), attacker.card, ordinaryTarget.card)).toBe(false);
        expect(canChallenge(scenarioRules(), attacker.card, bodyguard.card)).toBe(true);
    });
});
