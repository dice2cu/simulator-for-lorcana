import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/challenger-2-while-challenging-this-character-gets-2-feddc97b887d.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: feddc97b887d
const abilityText = "Challenger +2 (While challenging, this character gets +2 ¤.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Captain Hook - Forceful Duelist",
    "Clawhauser - Donut Detective",
    "Dr. Facilier - Charlatan",
    "Elinor - Bespelled Queen",
    "Helga Sinclair - Right-Hand Woman",
    "Hercules - Unwavering Demigod",
    "Li Shang - Solemn Son",
    "Luisa Madrigal - Pushing Through",
    "Prince Eric - Dashing and Brave",
    "Sisu - In Her Element",
    "Te Kā - Lava Monster",
    "Ursula - Mad Sea Witch",
    "Wee Dingwall - Scrappy Lad",
    "Yao - Imperial Soldier",
    "Darkwing Duck - Darkwarrior",
    "Demona - Betrayer of the Clan",
    "Diablo - Spiteful Raven",
    "Grandma Wu - Wise Grandmother",
    'Jetsam - Ursula\'s "Baby"',
    "Kenai - Magical Bear",
    "Sir Pellinore - Tougher Than He Looks",
    "Woolter & Jesse - Bellwether's Henchmen",
    "Arthur - Jousting Knight",
    "Raya - Unstoppable Force",
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
                    fullName: "Captain Hook - Forceful Duelist",
                    names: ["Captain Hook"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Dreamborn", "Villain", "Pirate", "Captain"],
                    cost: 1,
                    inkwell: true,
                    strength: 1,
                    willpower: 2,
                    lore: 1,
                }),
                exerted: !true,
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Test Defender",
                    names: ["Test Defender"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 99,
                    lore: 0,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const attacker = playerAt(scenarioGame, 1).play[0];
        const defender = playerAt(scenarioGame, 2).play[0];
        const expectedDamage = (scenarioRules().characteristic(attacker.card, "Strength") ?? 0) + 2;
        {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: attacker.card, defender: defender.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), defender.card).damage ?? 0).toEqual(expectedDamage);
    });
});
