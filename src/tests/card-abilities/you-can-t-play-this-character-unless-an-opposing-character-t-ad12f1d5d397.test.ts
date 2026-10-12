import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/you-can-t-play-this-character-unless-an-opposing-character-t-ad12f1d5d397.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: ad12f1d5d397
const abilityText = "You can't play this character unless an opposing character took damage this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Nathaniel Flint - Notorious Pirate",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
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
                    strength: 2,
                    willpower: 5,
                    lore: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 20 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                fullName: "Challenger",
                names: ["Challenger"],
                type: "Character",
                colors: [],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 1,
                willpower: 5,
                lore: 0,
            },
        ]);
        inPlay(scenarioRules(), playerAt(scenarioGame, 2).play[0].card).exerted = true;
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).hand[0];
        const opposingCharacter = playerAt(scenarioGame, 2).play[0];
        const canPlay = () =>
            (1 !== scenarioGame.turn.player
                ? []
                : scenarioLive?.request?.type === "Action"
                  ? scenarioLive.request.actions
                  : getLegalActions(scenarioGame, { card: scenarioCards.lookup })
            ).some((action) => action.type === "Play" && sameCard(cardInAction(action), source));
        {
            scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
            scenarioResolution = scenarioLive;
            resolvePlayers(
                scenarioResolution,
                {},
                {
                    untilAction: true,
                },
            );
            scenarioGame = finished(scenarioResolution, true);
            if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
        }
        expect(canPlay()).toBe(false);
        expect(
            await (async () => {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: player.play[0].card, defender: opposingCharacter.card };
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {},
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            })(),
        ).toBe(true);
        expect(canPlay()).toBe(true);
    });
});
