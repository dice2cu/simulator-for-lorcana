import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay, keywords as cardKeywords } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { describe, expect, it } from "vitest";
// Generated ability ID: 509769301a55
const abilityText = "This character can't gain Evasive.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Buzz Lightyear - Grounded",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("also rejects Evasive supplied by a location continuous ability", () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "RLS Legacy - Solar Galleon"]);
        const [source, location] = playerAt(scenarioGame, 1).play.map((state) => state.card);
        inPlay(scenarioRules(), source).location = location;
        expect(scenarioRules().keyword(source, "Evasive")).toBe(0);
    });
    it("does not gain Evasive from a resolved modifier", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const source = playerAt(scenarioGame, 1).play[0].card;
        {
            const sourceDefinition = scenarioCards.definition(source.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                {
                    type: "Sequence",
                    effects: [
                        { type: "Modify Cards", cards: { cards: [source] }, modifier: { gainKeyword: "Evasive" } },
                        { type: "Modify Cards", cards: { cards: [source] }, modifier: { gainKeyword: "Support" } },
                    ],
                },
                { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(cardKeywords(scenarioRules(), source).map((keyword) => keyword.toLowerCase())).not.toContain("evasive");
        expect(cardKeywords(scenarioRules(), source)).toContain("Support");
    });
});
