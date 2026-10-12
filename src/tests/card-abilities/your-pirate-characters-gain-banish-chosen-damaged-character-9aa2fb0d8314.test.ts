import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/your-pirate-characters-gain-banish-chosen-damaged-character-9aa2fb0d8314.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 9aa2fb0d8314
const abilityText = "Your Pirate characters gain “⟳ — Banish chosen damaged character” this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Walk the Plank!",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("grants the exert-to-banish ability to friendly Pirates, not other characters", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Pirate",
                    names: ["Pirate"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Pirate"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Not Pirate",
                    names: ["Not Pirate"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Damaged",
                    names: ["Damaged"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 5,
                    lore: 0,
                }),
                damage: 1,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Undamaged",
                    names: ["Undamaged"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 5,
                    lore: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [source, pirate, other] = playerAt(scenarioGame, 1).play;
        const [damaged, undamaged] = playerAt(scenarioGame, 2).play;
        pirate.drying = false;
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                {
                    type: "Modify Cards",
                    cards: { zone: "Play", player: "You", cardType: "Character", where: { classification: "Pirate" } },
                    modifier: {
                        gainAbility: {
                            type: "Activated",
                            cost: [{ type: "Exert", cards: "Self" }],
                            effect: {
                                type: "Choose Cards",
                                from: { zone: "Play", cardType: "Character", where: { damage: { atLeast: 1 } } },
                                count: 1,
                                effect: { type: "Banish", cards: "Selected Cards" },
                            },
                        },
                    },
                    duration: { until: "End Of Turn" },
                },
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        const actions = scenarioGame.turn.player !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        const index = actions.findIndex(
            (action) => action.type === "Activate" && ("card" in action ? action.card.i === pirate.card.i : action.ability.card.i === pirate.card.i),
        );
        expect(index).toBeGreaterThanOrEqual(0);
        expect(
            actions.filter(
                (action) => action.type === "Activate" && ("card" in action ? action.card.i === other.card.i : action.ability.card.i === other.card.i),
            ),
        ).toEqual([]);
        const activated = actions[index];
        if (!activated) throw new Error("The Pirate did not gain a usable ability");
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = activated;
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Exert", cards: { cards: [scenarioCards.instance(2)] } }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(0);
                            return {
                                type: "Decision",
                                answer: { type: "Pay Cost", pay: true, payment: [{ type: "Exert", player: 1, cards: [scenarioCards.instance(2)] }] },
                            };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(4)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(!inPlay(scenarioRules(), pirate.card).exerted).toBe(false);
        expect(playerAt(scenarioGame, 2).play.map((ink) => ink.card)).toEqual([undamaged.card]);
        expect(playerAt(scenarioGame, 2).discard).toEqual([damaged.card]);
    });
});
