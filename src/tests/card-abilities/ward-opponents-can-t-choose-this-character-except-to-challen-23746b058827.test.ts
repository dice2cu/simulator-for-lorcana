import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay, keywords as cardKeywords } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/ward-opponents-can-t-choose-this-character-except-to-challen-23746b058827.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 23746b058827
const abilityText = "Ward (Opponents can't choose this character except to challenge.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Aladdin - Prince Ali",
    "Aurora - Tranquil Princess",
    "Big Mama - Clever and Calming",
    "Darkwing Duck - Drake Mallard",
    "Donald Duck - Strutting His Stuff",
    "Doug - Lying in Wait",
    "Duke Weaselton - Small-Time Crook",
    "Hades - Meticulous Schemer",
    "Heathcliff - Stoic Butler",
    "Kaa - Suspicious Serpent",
    "Kit Cloudkicker - Spunky Bear Cub",
    "Merida - Defiant Daughter",
    "Merryweather - Feisty Fairy",
    "Prince Phillip - Royal Explorer",
    "Scuttle - Birdbrained",
    "Skippy - Energetic Rabbit",
    "The Huntsman - On the Queen's Orders",
    "The Nokk - Water Spirit",
    "The Queen - Cruelest of All",
    "Thomas O'Malley - Feline Charmer",
    "Winifred - Exasperated Elephant",
    "Alice - Savvy Sailor",
    "Ariel - Treasure Collector",
    "Audrey Ramirez - The Engineer",
    "Belle - Of the Ball",
    "Dr. Bushroot - Evil Botanist",
    "Goofy - Expert Shipwright",
    "Hercules - Baby Demigod",
    "Jetsam - Riffraff",
    "Kida - Creative Thinker",
    "Kit Cloudkicker - Navigator",
    "Kronk - Laid Back",
    "Kuzco - Temperamental Emperor",
    "Lady Kluck - Protective Confidant",
    "Megara - Liberated One",
    "Minnie Mouse - Mrs. Cratchit",
    "Minnie Mouse - Urban Visionary",
    "Patch - Playful Pup",
    "Prince John - Greediest of All",
    "Ratigan - Greedy Genius",
    "Robin Hood - Timely Contestant",
    "Roo - Hunny Rogue",
    "Scar - Vengeful Lion",
    "Splatter Phoenix - Rejected Artist",
    "The Muses - Proclaimers of Heroes",
    "The Queen - Crown of the Council",
    "Wendy Darling - Authority on Peter Pan",
    "Zipper - Astute Decoy",
    "Cogsworth - Grandfather Clock",
    "Darkwing Duck & Launchpad - St. Canard's Finest",
    "Hera - Queen of the Gods",
    "Pete - Bad Guy",
    "Tamatoa - Seeker of Shine",
    "The Queen - Fairest of All",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Aladdin - Prince Ali",
                    names: ["Aladdin"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Hero", "Prince"],
                    cost: 2,
                    inkwell: true,
                    strength: 2,
                    willpower: 2,
                    lore: 1,
                }),
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Stitch - Rock Star",
                    names: ["Stitch"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Floodborn", "Hero", "Alien"],
                    cost: 6,
                    inkwell: true,
                    strength: 3,
                    willpower: 5,
                    lore: 3,
                }),
                exerted: !false,
            },
        ]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, ["Dragon Fire"]);
        playerAt(scenarioGame, 2).inkwell = Array.from({ length: 5 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        const [wardCharacter, ordinaryCharacter] = playerAt(scenarioGame, 1).play;
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 2 && action.card.fullName === "Dragon Fire",
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                2: new ScriptedPlayer()
                    .on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 5 }]);
                        expect(request.ink[0].player).toBe(2);
                        expect(request.ink[0].cards).toHaveLength(5);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [
                                    {
                                        type: "Ink",
                                        player: 2,
                                        cards: [
                                            request.ink[0].cards[0],
                                            request.ink[0].cards[1],
                                            request.ink[0].cards[2],
                                            request.ink[0].cards[3],
                                            request.ink[0].cards[4],
                                        ],
                                    },
                                ],
                            },
                        };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(cardKeywords(scenarioRules(), wardCharacter.card)).toContainEqual("Ward");
        expect(inPlay(scenarioRules(), wardCharacter.card).damage ?? 0).toBe(0);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).not.toContainEqual(ordinaryCharacter.card);
    });
});
