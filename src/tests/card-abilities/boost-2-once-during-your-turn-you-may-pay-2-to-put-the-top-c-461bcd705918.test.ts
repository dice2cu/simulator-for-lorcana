import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/boost-2-once-during-your-turn-you-may-pay-2-to-put-the-top-c-461bcd705918.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 461bcd705918
const abilityText = "Boost 2 ⬡ (Once during your turn, you may pay 2 ⬡ to put the top card of your deck facedown under this character.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Alice - Well-Read Whisper",
    "Bambi - Ethereal Fawn",
    "Beast - Aggressive Lord",
    "Cheshire Cat - Inexplicable",
    "Flynn Rider - Spectral Scoundrel",
    "Gaston - Frightful Bully",
    "Goofy - Ghost of Jacob Marley",
    "Hercules - Spectral Demigod",
    "Jasmine - Soothing Princess",
    "Jiminy Cricket - Ghost of Christmas Past",
    "Kanga - Peaceful Gatherer",
    "Lady Tremaine - Sinister Socialite",
    "Merlin - Completing His Research",
    "Rapunzel - Ethereal Protector",
    "Scar - Eerily Prepared",
    "Zeus - Missing His Spark",
    "Tamatoa - Seeker of Shine",
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
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Mickey Mouse - True Friend"].reverse());
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 2 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const cardToBoost = [...playerAt(scenarioGame, 1).deck].reverse()[0];
        const abilityIndex =
            scenarioCards.definition(source.card.fullName).abilities?.findIndex((effect) => effect.type === "Keyword" && effect.keyword.name === "Boost") ?? -1;
        if (abilityIndex < 0) throw new Error("Boost ability was not parsed.");
        const used = await (async () => {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) =>
                    action.player === 1 &&
                    ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source.card) && action.ability.i === abilityIndex) ||
                        (action.type === "Boost" && action.ability === abilityIndex && sameCard(action.card, source.card))),
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Pay Cost", (request) => {
                    expect(request.optional).toBe(false);
                    expect(request.cost).toEqual([{ type: "Ink", amount: 2 }]);
                    expect(request.ink[0].player).toBe(1);
                    expect(request.ink[0].cards).toHaveLength(2);
                    return {
                        type: "Decision",
                        answer: {
                            type: "Pay Cost",
                            pay: true,
                            payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1]] }],
                        },
                    };
                }),
            });
            scenarioGame = finished(scenarioResolution);
            return true;
        })();
        expect(used).toBe(true);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).not.toContainEqual(cardToBoost);
        expect((inPlay(scenarioRules(), source.card).under ?? []).map((state) => state.card)).toContainEqual(cardToBoost);
        expect(playerAt(scenarioGame, 1).inkwell.filter((card) => !card.exerted)).toHaveLength(0);
    });
});
