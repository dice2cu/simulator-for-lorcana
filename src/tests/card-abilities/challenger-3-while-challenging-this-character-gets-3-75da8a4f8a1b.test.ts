import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/challenger-3-while-challenging-this-character-gets-3-75da8a4f8a1b.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 75da8a4f8a1b
const abilityText = "Challenger +3 (While challenging, this character gets +3 ¤.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Elsa - Gloves Off",
    "Jafar - Wicked Sorcerer",
    "Rabbit - Fed Up",
    "Sheriff of Nottingham - Vine Slayer",
    "Helga Sinclair - Tough as Nails",
    "Rafiki - Mystical Fighter",
    "Scar - Tempestuous Lion",
    "Archimedes - Electrified Owl",
    "Captain Hook - Thinking a Happy Thought",
    "Sven - Leaping Reindeer",
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
            {
                definition: scenarioCards.fixture({
                    fullName: "Elsa - Gloves Off",
                    names: ["Elsa"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Hero", "Queen", "Sorcerer"],
                    cost: 4,
                    inkwell: true,
                    strength: 3,
                    willpower: 4,
                    lore: 1,
                }),
                exerted: !true,
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Test Defender",
                    names: ["Test Defender"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 99,
                    lore: 0,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const attacker = playerAt(scenarioGame, 1).play[0];
        const defender = playerAt(scenarioGame, 2).play[0];
        const expectedDamage = (scenarioRules().characteristic(attacker.card, "Strength") ?? 0) + 3;
        {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: attacker.card, defender: defender.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), defender.card).damage ?? 0).toEqual(expectedDamage);
    });
});
