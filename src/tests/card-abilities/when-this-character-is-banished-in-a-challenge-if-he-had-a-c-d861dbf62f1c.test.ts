import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/when-this-character-is-banished-in-a-challenge-if-he-had-a-c-d861dbf62f1c.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: d861dbf62f1c
const abilityText = "When this character is banished in a challenge, if he had a card under him, draw 2 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Merlin - Completing His Research",
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
                    fullName: "Banisher",
                    names: ["Banisher"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 20,
                    willpower: 20,
                    lore: 1,
                }),
                exerted: !false,
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, [prototypeCardName, prototypeCardName].reverse());
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        const underneath = playerAt(scenarioGame, 1).hand.pop();
        if (!underneath) throw new Error("Missing underneath fixture");
        inPlay(scenarioRules(), source.card).under = [{ card: underneath, faceDown: true }];
        const banisher = playerAt(scenarioGame, 2).play[0];
        {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source.card, defender: banisher.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(2);
    });
});
