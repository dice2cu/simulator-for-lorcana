import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/while-being-challenged-this-character-gets-2-734cedc0369f.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 734cedc0369f
const abilityText = "While being challenged, this character gets +2 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Enchantress - Unexpected Judge",
    "Flora - Good Fairy",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each(["Attacker", "Defender"] as const)("gets the bonus only as the defender, not as the %s", async (role) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Enchantress - Unexpected Judge",
                    names: ["Enchantress"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Dreamborn", "Sorcerer"],
                    cost: 2,
                    inkwell: true,
                    strength: 1,
                    willpower: 1,
                    lore: 2,
                }),
                exerted: !(role === "Attacker"),
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Opponent",
                    names: ["Opponent"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 30,
                    lore: 0,
                }),
                exerted: !(role === "Defender"),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const opposingCard = playerAt(scenarioGame, 2).play[0];
        const printedStrength =
            (() => {
                const definition = scenarioCards.definition(source.card.fullName);
                if (definition.type !== "Character") throw new Error("Expected a character");
                return definition.strength;
            })() ??
            scenarioRules().characteristic(source.card, "Strength") ??
            0;
        expect(scenarioRules().characteristic(source.card, "Strength")).toEqual(printedStrength);
        if (role === "Defender") {
            scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
            {
                const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker: opposingCard.card, defender: source.card };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
            }
        } else {
            {
                const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source.card, defender: opposingCard.card };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
            }
        }
        expect(inPlay(scenarioRules(), opposingCard.card).damage ?? 0).toBe(printedStrength + (role === "Defender" ? 2 : 0));
        expect(scenarioRules().characteristic(source.card, "Strength")).toEqual(printedStrength);
    });
});
