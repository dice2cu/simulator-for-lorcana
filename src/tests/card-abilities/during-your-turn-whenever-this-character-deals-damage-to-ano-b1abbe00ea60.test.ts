import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: b1abbe00ea60
const abilityText =
    "During your turn, whenever this character deals damage to another character in a challenge, you may deal the same amount of damage to another chosen character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Namaari - Heir of Fang",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("copies the actual three challenge damage to one other characters", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
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
                    willpower: 10,
                    lore: 0,
                },
                exerted: true,
            },
            {
                ...{
                    fullName: "Victim",
                    names: ["Victim"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                },
                fullName: "Splash One",
                names: ["Splash One"],
            },
            {
                ...{
                    fullName: "Victim",
                    names: ["Victim"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                },
                fullName: "Splash Two",
                names: ["Splash Two"],
            },
        ]);
        const source = playerAt(scenarioGame, 1).play[0].card,
            [victim, one, two] = playerAt(scenarioGame, 2).play;
        inPlay(scenarioRules(), source).modifiers = [{ stat: "Strength", amount: 1 }];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source, defender: victim.card };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(inPlay(scenarioRules(), victim.card).damage).toBe(3);
        expect(inPlay(scenarioRules(), one.card).damage).toBe(3);
        expect(inPlay(scenarioRules(), two.card).damage ?? 0).toBe(0);
    });
});
