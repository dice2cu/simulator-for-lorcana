import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/your-characters-named-jetsam-gain-when-this-character-is-ban-54dc64a42ea7.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 54dc64a42ea7
const abilityText = "Your characters named Jetsam gain “When this character is banished in a challenge, return this card to your hand.”";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    'Flotsam - Ursula\'s "Baby"',
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Jetsam",
                    names: ["Jetsam"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 1,
                    willpower: 2,
                    lore: 0,
                }),
                exerted: !true,
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Defender",
                    names: ["Defender"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 5,
                    willpower: 8,
                    lore: 0,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0],
            jetsam = playerAt(scenarioGame, 1).play[1],
            defender = playerAt(scenarioGame, 2).play[0];
        const ability: Ability = {
            type: "Static",
            rule: {
                type: "Modify Cards",
                cards: { zone: "Play", player: "You", cardType: "Character", where: { name: "Jetsam" } },
                modifier: {
                    gainAbility: {
                        type: "Triggered",
                        trigger: { event: "Banish", card: "Self", kind: "Challenge" },
                        effect: { type: "Move Card", cards: "Self", to: "Hand" },
                    },
                },
            },
            name: "OMINOUS PAIR",
        };
        {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: jetsam.card, defender: defender.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(jetsam.card);
        expect(playerAt(scenarioGame, 1).discard).not.toContainEqual(jetsam.card);
    });
});
