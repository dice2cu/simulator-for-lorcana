import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: b747bda0310a
const abilityText =
    "When this character is banished, if any of the cards that were under them are character cards, you may play those characters from your discard for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Sulley & Boo - Scare Buddies",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("replays only the characters actually under the banished source for free", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, ["HeiHei - Boat Snack"]);
        const source = playerAt(scenarioGame, 1).play[0].card,
            unrelated = playerAt(scenarioGame, 1).discard[0];
        inPlay(scenarioRules(), source).under = ["Hercules - True Hero", "Dinglehopper"].map((card) => ({ card: scenarioCards.create(card), faceDown: true }));
        const tucked = (playerAt(scenarioGame, 1).play[0].under ?? []).map((under) => under.card);
        {
            const sourceDefinition = scenarioCards.definition(source.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Banish", cards: { cards: [source] } },
                { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    })
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: false } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).play.map((state) => state.card)).toEqual([tucked[0]]);
        expect(playerAt(scenarioGame, 1).discard).toEqual([unrelated, source, tucked[1]]);
        expect(playerAt(scenarioGame, 1).inkwell).toEqual([]);
    });
});
