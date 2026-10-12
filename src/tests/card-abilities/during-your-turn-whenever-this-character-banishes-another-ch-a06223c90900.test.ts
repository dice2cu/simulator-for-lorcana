import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { describe, expect, it } from "vitest";
// Generated ability ID: a06223c90900
const abilityText = "During your turn, whenever this character banishes another character in a challenge, your other characters get +1 ◊ this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Donald Duck - Buccaneer",
    "Mulan - Imperial Soldier",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each(cardsWithEffect)("grants lore to other characters after %s wins a challenge", async (name) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [name, "HeiHei - Boat Snack"]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: {
                    fullName: "Victim",
                    names: ["Victim"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                },
                exerted: true,
            },
        ]);
        const source = playerAt(scenarioGame, 1).play[0].card,
            target = playerAt(scenarioGame, 1).play[1].card,
            defender = playerAt(scenarioGame, 2).play[0].card;
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source, defender };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(scenarioRules().characteristic(target, "Lore")).toBe(2);
        const printed = scenarioCards.definition(name);
        if (printed.type !== "Character") throw new Error("Expected character");
        expect(scenarioRules().characteristic(source, "Lore")).toBe(printed.lore);
    });
});
