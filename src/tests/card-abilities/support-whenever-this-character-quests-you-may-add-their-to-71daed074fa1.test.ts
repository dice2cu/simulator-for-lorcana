import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/support-whenever-this-character-quests-you-may-add-their-to-71daed074fa1.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 71daed074fa1
const abilityText = "Support (Whenever this character quests, you may add their ¤ to another chosen character's ¤ this turn.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Agustin Madrigal - Exceptionally Kind",
    "Anna - Making Snow Plans",
    "B.E.N. - Eccentric Robot",
    "Basil - Of Baker Street",
    "Basil - Practiced Detective",
    "Bolt - Dependable Friend",
    "Chief Tui - Respected Leader",
    "Daisy Duck - Ghost Finder",
    "Dewey - Showy Nephew",
    "Eilonwy - Princess of Llyr",
    "Fauna - Good-Natured Fairy",
    "Happy - Good-Natured",
    "HeiHei - Boat Snack",
    "Lilo - Junior Cake Decorator",
    "Lilo - Patient Weaver",
    "Louie - Chill Nephew",
    "Merlin - Self-Appointed Mentor",
    "Minnie Mouse - Tiny Tim's Mother",
    "Mirabel Madrigal - Prophecy Finder",
    "Miriam Mendelsohn - Front-Row Fan",
    "Mulan - Free Spirit",
    "Olaf - Trusting Companion",
    "Philoctetes - Trainer of Heroes",
    "Pluto - Suspicious Sentry",
    "Robin Hood - Eye for Detail",
    "Rolly - Hungry Pup",
    "Rutt - Northern Moose",
    "Tiana - Warm and Happy",
    "Trusty - Loyal Bloodhound",
    "Wasabi - Always Prepared",
    "Anna - Ice Breaker",
    "Baloo - Friend and Guardian",
    "Baymax - Upgraded Robot",
    "Blue Fairy - Guiding Light",
    "Chicha - Dedicated Mother",
    "Clarabelle - News Reporter",
    "Flounder - Collector's Companion",
    "Huey - Savvy Nephew",
    "Jebidiah Farnsworth - Expedition Cook",
    "Judy Hopps - Day Camp Instructor",
    "Judy Hopps - Resourceful Rabbit",
    "Maximus - Palace Horse",
    "Mickey Mouse - Leader of the Band",
    "Mirabel Madrigal - Gift of the Family",
    "Nani - Caring Sister",
    "Perla - Nimble Seamstress",
    "Prince Phillip - Gallant Defender",
    "Rapunzel - Ready for Adventure",
    "Rolly - Chubby Puppy",
    "Sheriff of Nottingham - Bushel Britches",
    "Taran - Pig Keeper",
    "The Queen - Conceited Ruler",
    "Wendy Darling - Authority on Peter Pan",
    "Winnie the Pooh - Hunny Pirate",
    "Anna - Magical Mission",
    "Daisy Duck - Paranormal Investigator",
    "Lilo & Stitch - Fun-Loving Friends",
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
                    fullName: "Agustin Madrigal - Exceptionally Kind",
                    names: ["Agustin Madrigal"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Dreamborn", "Mentor", "Madrigal"],
                    cost: 4,
                    inkwell: true,
                    strength: 3,
                    willpower: 6,
                    lore: 1,
                }),
                exerted: !true,
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
                exerted: !true,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [supporter, target] = playerAt(scenarioGame, 1).play;
        const startingStrength = scenarioRules().characteristic(target.card, "Strength") ?? 0;
        const supportStrength = scenarioRules().characteristic(supporter.card, "Strength") ?? 0;
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: supporter.card };
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
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(scenarioRules().characteristic(target.card, "Strength")).toBe(startingStrength + supportStrength);
    });
});
