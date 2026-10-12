import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
import type { ActionCard } from "../../model/card";
// Generated ability ID: 4b1929a356d0
const abilityText = "This character can't sing songs without Sing Together.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Meilin Lee - Lead Vocalist",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("can sing only songs with Sing Together", () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const song: ActionCard = {
            fullName: "Ordinary Song",
            names: ["Ordinary Song"],
            type: "Action" as const,
            subtypes: ["Song"],
            colors: ["Amber" as const],
            cost: 1,
            inkwell: false,
            playRules: [{ type: "Sing" as const, cost: 1 }],
            effect: { type: "Sequence" as const, effects: [] },
        };
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            song,
            {
                ...song,
                fullName: "Together Song",
                names: ["Together Song"],
                playRules: [{ type: "Sing Together", cost: 1 }],
            },
        ]);
        const source = playerAt(scenarioGame, 1).play[0].card;
        const [ordinarySong, togetherSong] = playerAt(scenarioGame, 1).hand;
        const actions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(
            actions.some(
                (action) => action.type === "Sing" && sameCard(action.song, ordinarySong) && action.singers.some((singer) => sameCard(singer, source)),
            ),
        ).toBe(false);
        expect(
            actions.some(
                (action) => action.type === "Sing" && sameCard(action.song, togetherSong) && action.singers.some((singer) => sameCard(singer, source)),
            ),
        ).toBe(true);
    });
});
