import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-one-of-your-pirate-characters-quests-while-at-a-loc-d970405db3ec.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: d970405db3ec
const abilityText = "Whenever one of your Pirate characters quests while at a location, draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Daisy Duck - Pirate Captain",
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
                    fullName: "Quester",
                    names: ["Quester"],
                    type: "Character",
                    colors: ["Sapphire"],
                    subtypes: ["Ally", "Floodborn", "Pirate"],
                    cost: 0,
                    inkwell: false,
                    strength: 4,
                    willpower: 6,
                    lore: 1,
                }),
            },
            "Motunui - Island Paradise",
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, [prototypeCardName].reverse());
        const player = playerAt(scenarioGame, 1);
        playerAt(scenarioGame, 2).lore = 10;
        const [source, quester] = playerAt(scenarioGame, 1).play;
        quester.location = playerAt(scenarioGame, 1).play[2].card;
        const questLore = scenarioRules().characteristic(quester.card, "Lore") ?? 0;
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: quester.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(1);
    });
});
