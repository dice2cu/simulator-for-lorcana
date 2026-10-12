import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/while-there-s-a-card-under-this-character-your-characters-wi-0f52242bb7fd.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 0f52242bb7fd
const abilityText = "While there's a card under this character, your characters with Reckless gain “⟳ — Gain 1 lore.”";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Aladdin - Barreling Through",
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
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const ability: Ability = {
            type: "Static",
            rule: {
                type: "Conditional",
                if: { every: "Self", where: { cardsUnder: { atLeast: 1 } } },
                then: {
                    type: "Modify Cards",
                    cards: { zone: "Play", player: "You", cardType: "Character", where: { keyword: "Reckless" } },
                    modifier: {
                        gainAbility: { type: "Activated", cost: [{ type: "Exert", cards: "Self" }], effect: { type: "Gain Lore", player: "You", amount: 1 } },
                    },
                },
            },
            name: "ONLY THE BOLD",
        };
        const before = playerAt(scenarioGame, 1).lore;
        inPlay(scenarioRules(), source.card).under = [
            scenarioCards.create(
                scenarioCards.fixture({
                    fullName: "Under Card",
                    names: ["Under Card"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ),
        ].map((card) => ({ card, faceDown: true }));
        const activate = (scenarioGame.turn.player !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).find(
            (action) => action.type === "Activate" && "rule" in action,
        );
        if (!activate) throw new Error("Missing granted activation");
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = activate;
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Exert", cards: { cards: [scenarioCards.instance(1)] } }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(0);
                        return {
                            type: "Decision",
                            answer: { type: "Pay Cost", pay: true, payment: [{ type: "Exert", player: 1, cards: [scenarioCards.instance(1)] }] },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).lore).toBe(before + 1);
    });
});
