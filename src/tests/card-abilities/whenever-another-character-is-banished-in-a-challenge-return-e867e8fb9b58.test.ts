import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-another-character-is-banished-in-a-challenge-return-e867e8fb9b58.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: e867e8fb9b58
const abilityText = "Whenever another character is banished in a challenge, return that card to its player's hand, then that player discards a card at random.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Yzma - Above It All",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).discard = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Banished",
                names: ["Banished"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
        ]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Existing",
                names: ["Existing"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        const p = playerAt(scenarioGame, 1),
            o = playerAt(scenarioGame, 2),
            s = playerAt(scenarioGame, 1).play[0],
            banished = playerAt(scenarioGame, 2).discard[0],
            a: Effect = printedEffect(scenarioCards.definition(s.card.fullName), 2);
        {
            const sourceDefinition = scenarioCards.definition(s.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                a,
                { card: s.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(
                scenarioResolution,
                {},
                {
                    random: [{ type: "Random Cards", cards: [] }],
                },
            );
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 2).hand.length).toBe(1);
        expect(playerAt(scenarioGame, 2).discard.length).toBe(1);
    });
});
