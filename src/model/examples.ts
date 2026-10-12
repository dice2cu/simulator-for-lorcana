/**
 * Review examples, not replacements for the engine's current card definitions.
 */
import type { Ability, CardRules } from "./ability";
import type { CardModifier, PlayerModifier } from "./game-state";

/**
 * Concrete modifiers after resolution: no printed text, source lookup, or effect ID.
 */
export const modifierExamples = {
    rapunzelProtection: { preventDamage: "Next", expires: { startOfNextTurn: 1, afterTurn: 7 } },
    johnSilver: {
        gainKeyword: "Reckless",
        starts: { startOfNextTurn: 2, afterTurn: 7 },
        expires: { endOfNextTurn: 2, afterTurn: 7 },
    },
} satisfies Record<string, CardModifier>;

/**
 * Lasting rules stored with their acting player, without arbitrary effect IDs.
 */
export const playerModifierExamples = {
    nextCharacterDiscount: {
        source: { card: { fullName: "Lantern", i: 10 }, player: 1, kind: "Ability" },
        rule: { type: "Modify Cost", cards: { zone: "Any", player: "You", cardType: "Character" }, amount: -1, for: "Play" },
        uses: 1, expires: { endOfTurn: 7 },
    },
    delayedBanish: {
        source: { card: { fullName: "Gruesome and Grim", i: 11 }, player: 1, kind: "Action" },
        trigger: { event: "Turn End", player: "You" }, uses: 1,
        effect: { type: "Banish", cards: { zone: "Play", cards: [{ fullName: "Merlin - Goat", i: 12 }] } },
    },
    readyLimit: { readyLimit: 1, expires: { endOfNextTurn: 2, afterTurn: 7 } },
    futureCharacters: {
        source: { card: { fullName: "Restoring Atlantis", i: 15 }, player: 1, kind: "Action" },
        rule: { type: "Modify Cards", cards: { zone: "Play", player: "You", cardType: "Character" }, modifier: { restriction: "Can't Be Challenged" } },
        expires: { startOfNextTurn: 1, afterTurn: 7 },
    },
    scopedUnderPermission: {
        permission: "Can Play From Under",
        cards: { zone: "Under", player: "You", cardType: "Character", under: { cards: [{ fullName: "The Black Cauldron", i: 8 }] } },
        expires: { endOfTurn: 7 },
    },
} satisfies Record<string, PlayerModifier>;

export const grantedAbilityExample = {
    gainAbility: {
        type: "Triggered", trigger: { event: "Banish", card: "Self", kind: "Challenge" },
        effect: { type: "Optional", effect: { type: "Move Card", cards: "Self", to: "Hand" } },
    },
    expires: { endOfTurn: 7 },
} satisfies CardModifier;

/**
 * Focused rules excerpts, not complete catalog entries for these cards.
 */
export const cardRuleExamples = {
    clubDoor: {
        type: "Item", abilities: [],
        playRules: [{
            type: "Alternate Cost", cost: [],
            when: { exists: { zone: "Play", player: "You", cardType: "Character", where: { name: "Fat Cat" } } },
        }],
    },
    escapePlan: {
        type: "Action",
        playRules: [{
            type: "Requirement",
            when: { value: { countEvents: { event: "Move Card", to: "Discard", player: "You" }, during: "This Turn" }, is: { atLeast: 2 } },
        }],
        effect: {
            type: "For Each Player", players: "All",
            effect: {
                type: "Choose Cards", player: "Selected Player",
                from: { zone: "Play", player: "Selected Player", cardType: "Character" }, count: 2,
                effect: { type: "Move Card", cards: "Selected Cards", to: "Inkwell", exerted: true },
            },
        },
    },
} satisfies Record<string, CardRules>;

export const actionCardExamples = {
    iveGotADream: {
        type: "Action",
        playRules: [{ type: "Sing", cost: 2 }],
        effect: {
            type: "Choose Cards", count: 1,
            from: { zone: "Play", player: "You", cardType: "Character", where: { at: { zone: "Play", cardType: "Location" } } },
            effect: { type: "Sequence", effects: [
                { type: "Ready", cards: "Selected Cards" },
                { type: "Modify Cards", cards: "Selected Cards", modifier: { restriction: "Can't Quest" }, duration: { until: "End Of Turn" } },
                { type: "Gain Lore", player: "You", amount: { stat: "Lore", card: { locationOf: "Selected Cards" } } },
            ] },
        },
    },
    familyScattered: {
        type: "Action",
        effect: {
            type: "Choose Player", from: "Opponents",
            effect: {
                type: "Choose Cards", from: { zone: "Play", player: "Selected Player", cardType: "Character" },
                player: "Selected Player", count: 3,
                effect: {
                    type: "Sequence", effects: [
                        {
                            type: "Choose Cards", from: "Selected Cards", player: "Selected Player", count: 1,
                            effect: { type: "Move Card", cards: "Selected Cards", to: "Hand" },
                        },
                        {
                            type: "Choose Cards", from: { filter: "Selected Cards", where: { zone: "Play" } }, player: "Selected Player", count: 1,
                            effect: { type: "Move Card", cards: "Selected Cards", to: "Deck", position: "Bottom" },
                        },
                        { type: "Move Card", cards: { filter: "Selected Cards", where: { zone: "Play" } }, to: "Deck", position: "Top" },
                    ],
                },
            },
        },
    },
    healingTotal: {
        type: "Action",
        effect: {
            type: "Sequence", effects: [
                {
                    type: "Remove Damage", cards: { zone: "Play", player: "You", cardType: "Character" },
                    amount: { upTo: 4 }, distribution: "Total",
                },
                { type: "Gain Lore", player: "You", amount: { result: "Damage Removed" } },
            ],
        },
    },
    colorsOfTheWind: {
        type: "Action",
        effect: {
            type: "Sequence", effects: [
                { type: "For Each Player", players: "All", effect: { type: "Reveal", cards: { zone: "Deck", player: "Selected Player", take: 1 } } },
                { type: "Draw", player: "You", amount: { distinct: "Ink Type", cards: { result: "Revealed Cards" } } },
            ],
        },
    },
    nextStopOlympus: {
        type: "Action",
        effect: {
            type: "Choose Cards", from: { zone: "Play", cardType: "Character" }, count: 1,
            effect: {
                type: "Sequence", effects: [
                    { type: "Ready", cards: "Selected Cards" },
                    { type: "Modify Cards", cards: "Selected Cards", modifier: { restriction: "Can't Quest" }, duration: { until: "End Of Turn" } },
                    {
                        type: "Create Trigger", uses: 1, duration: { until: "End Of Turn" },
                        trigger: {
                            event: "Challenge", attacker: { capture: "Selected Cards" },
                            defender: { zone: "Play", cardType: "Character" },
                        },
                        effect: { type: "Gain Lore", player: "You", amount: 1 },
                    },
                ],
            },
        },
    },
    piercingAttack: {
        type: "Action",
        effect: {
            type: "Choose Cards", from: { zone: "Play", cardType: "Character" }, count: 1,
            effect: { type: "Deal Damage", cards: "Selected Cards", amount: 2, ignoreResist: true },
        },
    },
    secondStarToTheRight: {
        type: "Action",
        playRules: [{ type: "Sing Together", cost: 10 }],
        effect: { type: "Choose Player", from: "All", effect: { type: "Draw", player: "Selected Player", amount: 5 } },
    },
    metamorphosis: {
        type: "Action",
        effect: {
            type: "Choose Cards",
            from: { zone: "Discard", player: "You", cardType: "Character", where: { keyword: "Shift" } }, count: 1,
            effect: { type: "Play", cards: "Selected Cards", method: "Shift", free: true },
        },
    },
    dangerousPlan: {
        type: "Action",
        effect: {
            type: "Sequence", effects: [
                { type: "Draw", player: "You", amount: 2 },
                { type: "Random Cards", from: { zone: "Hand", player: "You" }, count: 1, effect: { type: "Discard", cards: "Selected Cards" } },
            ],
        },
    },
    // Friends on the Other Side: Draw 2 cards.
    drawTwo: {
        type: "Action",
        playRules: [{ type: "Sing", cost: 3 }],
        effect: { type: "Draw", player: "You", amount: 2 },
    },

    // Let the Storm Rage On: Deal 2 damage to chosen character. Draw a card.
    damageThenDraw: {
        type: "Action",
        playRules: [{ type: "Sing", cost: 3 }],
        effect: {
            type: "Sequence",
            effects: [
                {
                    type: "Choose Cards",
                    from: { zone: "Play", cardType: "Character" },
                    count: 1,
                    effect: { type: "Deal Damage", cards: "Selected Cards", amount: 2 },
                },
                { type: "Draw", player: "You", amount: 1 },
            ],
        },
    },

    // Restoring Atlantis: Your characters can't be challenged until the start
    // of your next turn. This includes characters played afterward.
    atlantis: {
        type: "Action",
        effect: {
            type: "Create Rule",
            rule: { type: "Modify Cards", cards: { zone: "Play", player: "You", cardType: "Character" }, modifier: { restriction: "Can't Be Challenged" } },
            duration: { until: "Start Of Next Turn", player: "You" },
        },
    },

    // Lose the Way: Exert chosen character. Then you may choose and discard a
    // card. If you do, the exerted character can't ready at their next turn start.
    loseTheWay: {
        type: "Action",
        effect: {
            type: "Choose Cards",
            from: { zone: "Play", cardType: "Character" },
            count: 1,
            effect: {
                type: "Sequence",
                effects: [
                    { type: "Exert", cards: "Selected Cards" },
                    {
                        type: "Optional", effect: {
                            type: "Do Then",
                            do: {
                                type: "Choose Cards", from: { zone: "Hand", player: "You" }, count: 1,
                                effect: { type: "Discard", cards: "Selected Cards" },
                            },
                            then: {
                                type: "Modify Cards", cards: "Selected Cards",
                                modifier: { restriction: "Can't Ready At Start Of Turn" },
                                duration: { until: "End Of Next Turn", player: { ownerOf: "Selected Cards" } },
                            },
                        },
                    },
                ],
            },
        },
    },

    // Candy Drift: Draw. Give a chosen character of yours +5 strength this turn;
    // at the end of your turn, banish them. The delayed instruction captures target.
    candyDrift: {
        type: "Action",
        effect: {
            type: "Sequence",
            effects: [
                { type: "Draw", player: "You", amount: 1 },
                {
                    type: "Choose Cards",
                    from: { zone: "Play", player: "You", cardType: "Character" },
                    count: 1,
                    effect: {
                        type: "Sequence",
                        effects: [
                            {
                                type: "Modify Cards", cards: "Selected Cards",
                                modifier: { stat: "Strength", amount: 5 }, duration: { until: "End Of Turn" },
                            },
                            { type: "Delay", until: { turnEnd: "You" }, effect: { type: "Banish", cards: { capture: "Selected Cards" } } },
                        ],
                    },
                },
            ],
        },
    },

    // Water Has Memory: Look at the top 4 cards of chosen player's deck. Put one
    // on top and the rest on the bottom in any order. You can choose an opponent.
    waterHasMemory: {
        type: "Action",
        effect: {
            type: "Choose Player",
            from: "All",
            effect: {
                type: "Sequence",
                effects: [
                    {
                        type: "Look",
                        cards: { zone: "Deck", player: "Selected Player", take: 4 },
                    },
                    {
                        type: "Choose Cards",
                        from: { result: "Looked At Cards" },
                        count: 1,
                        effect: {
                            type: "Sequence",
                            effects: [
                                {
                                    type: "Move Card", cards: "Selected Cards",
                                    to: "Deck", position: "Top",
                                },
                                {
                                    type: "Move Card",
                                    cards: { difference: [{ result: "Looked At Cards" }, "Selected Cards"] },
                                    to: "Deck", position: "Bottom", order: "Chosen",
                                },
                            ],
                        },
                    },
                ],
            },
        },
    }
} satisfies Record<string, Extract<CardRules, { type: "Action" }>>;

export const abilityExamples = {
    flynnHighClimbingRogue: {
        type: "Triggered",
        trigger: { event: "Chosen", card: "Self", player: "Opponents" },
        effect: {
            type: "Choose Cards", player: { event: "Player" }, count: 1,
            from: { zone: "Hand", player: { event: "Player" } },
            effect: { type: "Discard", cards: "Selected Cards" },
        },
    },
    morphLittleImitator: {
        type: "Static",
        rule: { type: "Can Shift Onto", cards: { zone: "Any", player: "You", cardType: "Character" }, onto: "Self" },
    },
    belleAlwaysReading: {
        type: "Static",
        rule: { type: "Modify Cost", cards: { zone: "Any", player: "You", cardType: "Character" }, for: "Shift", onto: "Self", amount: -1 },
    },
    meilinSuperficiallyObedient: {
        type: "Triggered",
        trigger: { event: "Play", player: "You", onto: "Self" },
        effect: { type: "Modify Cards", cards: { event: "Card" }, modifier: { gainKeyword: "Evasive" }, duration: { until: "Start Of Next Turn", player: "You" } },
    },
    arthurDeterminedSquire: {
        type: "Static",
        rule: { type: "Modify Players", players: "You", modifier: { skipDrawStep: true } },
    },
    // Maui's Fish Hook: the free-use permission still requires exerting the item.
    mauisFishHook: {
        type: "Static", rule: {
            type: "Conditional", if: { exists: { zone: "Play", player: "You", cardType: "Character", where: { name: "Maui" } } },
            then: { type: "Free Ability", cards: "Self", name: "SHAPESHIFT" },
        },
    },
    // Chernabog - Unnatural Force: moving the character must actually succeed.
    chernabog: {
        type: "Triggered", trigger: { event: "Play", card: "Self" },
        effect: { type: "Optional", effect: {
            type: "Do Then",
            do: { type: "Choose Cards", from: { zone: "Play", player: "Opponents", cardType: "Character" }, count: 1,
                effect: { type: "Move Card", cards: "Selected Cards", to: "Deck", position: "Shuffle" } },
            then: { type: "Optional", player: { ownerOf: { result: "Moved Cards" } }, effect: {
                type: "Choose Cards", from: { zone: "Discard", player: { ownerOf: { result: "Moved Cards" } }, cardType: "Character" },
                player: { ownerOf: { result: "Moved Cards" } }, count: 1,
                effect: { type: "Play", cards: "Selected Cards", player: { ownerOf: "Selected Cards" }, free: true },
            } },
        } },
    },
    megara: {
        type: "Triggered", trigger: { event: "Play", card: "Self" },
        effect: { type: "Or", options: [
            { type: "Choose Cards", from: { zone: "Hand", player: "You" }, count: 1,
                effect: { type: "Discard", cards: "Selected Cards" } },
            { type: "Banish", cards: "Self" },
        ] },
    },
    diablo: {
        type: "Triggered", trigger: { event: "Play", card: "Self" },
        effect: { type: "Optional", effect: { type: "Look", cards: { zone: "Hand", player: "Opponents" } } },
    },
    annaTemporaryShift: {
        type: "Static", from: ["Hand"],
        rule: {
            type: "Conditional",
            if: { value: { countEvents: { event: "Move Card", from: "Discard" }, during: "This Turn" }, is: { atLeast: 1 } },
            then: { type: "Modify Cards", cards: "Self", modifier: { gainAbility: { type: "Keyword", keyword: { name: "Shift", cost: [{ type: "Ink", amount: 0 }] } } } },
        },
    },
    beastDamageReplacement: {
        type: "Replacement",
        replacement: {
            event: { event: "Deal Damage", card: { zone: "Play", player: "You", cardType: "Character", exclude: "Self" } },
            instead: { type: "Put Damage", cards: "Self", amount: { event: "Amount" } },
        },
    },
    liloFirstDamage: {
        type: "Replacement",
        replacement: { event: { event: "Deal Damage", card: "Self", when: { not: { duringTurnOf: "You" } } }, limit: { perTurn: 1, count: "Occurrences" } },
    },
    powhatansStaff: {
        type: "Activated", cost: [{ type: "Exert", cards: "Self" }, { type: "Ink", amount: 1 }],
        effect: {
            type: "Create Rule", uses: 1, duration: { until: "End Of Turn" },
            rule: {
                type: "Enter Play", cards: { zone: "Any", player: "You", cardType: "Character" }, exerted: true,
                modifier: { gainKeyword: "Bodyguard" }, duration: { until: "Start Of Next Turn", player: "You" },
            },
        },
    },
    sisuRepeat: {
        type: "Triggered", trigger: { event: "Quest", card: "Self" },
        effect: {
            type: "Repeat",
            until: { not: { every: { result: "Revealed Cards" }, where: { cardType: "Character", classification: "Dragon" } } },
            effect: {
                type: "Sequence", effects: [
                    { type: "Reveal", cards: { zone: "Deck", player: "You", take: 1 } },
                    {
                        type: "Conditional", if: { every: { result: "Revealed Cards" }, where: { cardType: "Character", classification: "Dragon" } },
                        then: { type: "Move Card", cards: { result: "Revealed Cards" }, to: "Hand" },
                        otherwise: {
                            type: "Or", options: [
                                { type: "Move Card", cards: { result: "Revealed Cards" }, to: "Deck", position: "Top" },
                                { type: "Move Card", cards: { result: "Revealed Cards" }, to: "Deck", position: "Bottom" },
                            ],
                        },
                    },
                ],
            },
        },
    },
    headlessHorseman: {
        type: "Triggered", trigger: { event: "Play", card: "Self" },
        effect: {
            type: "Sequence", effects: [
                { type: "Draw", player: "All", amount: 3 },
                {
                    type: "For Each Player", players: "All",
                    effect: { type: "Random Cards", from: { zone: "Hand", player: "Selected Player" }, count: 3, effect: { type: "Discard", cards: "Selected Cards" } },
                },
                {
                    type: "Choose Cards", from: { zone: "Play", player: "Opponents", cardType: "Character" }, count: 1,
                    effect: {
                        type: "Deal Damage", cards: "Selected Cards",
                        amount: { multiply: [2, { count: { filter: { result: "Discarded Cards" }, where: { cardType: "Action" } } }] },
                    },
                },
            ],
        },
    },
    lantern: {
        type: "Activated", cost: [{ type: "Exert", cards: "Self" }],
        effect: {
            type: "Create Rule", uses: 1, duration: { until: "End Of Turn" },
            rule: { type: "Modify Cost", cards: { zone: "Any", player: "You", cardType: "Character" }, amount: -1, for: "Play" },
        },
    },
    liloFromDiscard: {
        type: "Triggered", from: ["Discard"], trigger: { event: "Turn Start", player: "You" },
        effect: { type: "Optional", effect: { type: "Play", cards: "Self", exerted: true } },
    },
    marshmallow: {
        type: "Triggered", trigger: { event: "Quest", card: "Self" },
        effect: {
            type: "For Each Player", players: "Opponents",
            effect: {
                type: "Modify Players", players: "Selected Player", modifier: { readyLimit: 1 },
                duration: { until: "End Of Next Turn", player: "Selected Player" },
            },
        },
    },
    donaldVictoryThreshold: {
        type: "Static", rule: { type: "Modify Players", players: "Opponents", modifier: { victoryLore: 25 } },
    },
    angela: {
        type: "Static",
        rule: { type: "Modify Cards", cards: { zone: "Play", player: "You", cardType: "Character", where: { classification: "Gargoyle" } }, modifier: { loseAbility: { name: "Stone by Day" } } },
    },
    captainAmelia: {
        type: "Static", rule: { type: "Modify Cards", cards: "Self", modifier: { restriction: "Can't Be Challenged", by: { classification: "Pirate" } } },
    },
    elisaStatFloor: {
        type: "Static",
        rule: {
            type: "Modify Cards", cards: { zone: "Play", player: "You", cardType: "Character" },
            modifier: { minimumStat: "Strength", amount: { stat: "Strength", card: "Affected Card", printed: true } },
        },
    },
    turboShiftName: {
        type: "Static", rule: { type: "Modify Cards", cards: "Self", modifier: { countsAsName: "King Candy", for: "Shift" } },
    },
    entersWithDamage: {
        type: "Static", rule: { type: "Enter Play", cards: "Self", damage: 3 },
    },
    almaSearch: {
        type: "Triggered", trigger: { event: "Play", card: "Self" },
        effect: {
            type: "Optional", effect: {
                type: "Search", from: { zone: "Deck", player: "You", cardType: "Character", where: { classification: "Madrigal" } }, count: 1,
                effect: {
                    type: "Sequence", effects: [
                        { type: "Reveal", cards: "Selected Cards" },
                        { type: "Shuffle", player: "You" },
                        { type: "Move Card", cards: "Selected Cards", to: "Deck", position: "Top" },
                    ],
                },
            },
        },
    },
    fredRevealUntil: {
        type: "Triggered", trigger: { event: "Quest", card: "Self" },
        effect: {
            type: "Sequence", effects: [
                { type: "Reveal Until", player: "You", where: { cardType: "Character", classification: "Floodborn" } },
                { type: "Move Card", cards: { filter: { result: "Revealed Cards" }, where: { cardType: "Character", classification: "Floodborn" } }, to: "Hand" },
                { type: "Shuffle", player: "You" },
            ],
        },
    },
    ursulaReplay: {
        type: "Triggered", trigger: { event: "Sing", card: "Self" },
        effect: { type: "Optional", effect: { type: "Play", cards: { event: "Song" }, free: true, afterwards: "Deck Bottom" } },
    },
    goofyHealing: {
        type: "Triggered", trigger: { event: "Turn End", player: "You" },
        effect: {
            type: "Sequence", effects: [
                { type: "Remove Damage", cards: { zone: "Play", player: "You", cardType: "Character", exclude: "Self" }, amount: { upTo: 1 } },
                { type: "Ready", cards: { result: "Characters With Damage Removed" } },
            ],
        },
    },

    vinePod: {
        type: "Activated", cost: [{ type: "Exert", cards: "Self" }, { type: "Ink", amount: 1 }],
        effect: {
            type: "Choose Cards", from: { zone: "Play", player: "You", cardType: "Character" }, count: 1,
            effect: {
                type: "Sequence", effects: [
                    { type: "Banish", cards: "Selected Cards" },
                    {
                        type: "Optional", effect: {
                            type: "Choose Cards",
                            from: { zone: "Hand", player: "You", cardType: "Character", where: { sameNameAs: "Selected Cards" } }, count: 1,
                            effect: { type: "Play", cards: "Selected Cards", free: true },
                        },
                    },
                ],
            },
        },
    },

    hercules: {
        type: "Triggered", trigger: { event: "Play", card: "Self" },
        effect: {
            type: "Optional", effect: {
                type: "Do Then",
                do: { type: "Discard", cards: { zone: "Hand", player: "You" } },
                then: {
                    type: "Choose Cards", from: { zone: "Discard", player: "You" }, count: 1,
                    effect: { type: "Move Card", cards: "Selected Cards", to: "Hand" },
                },
            },
        },
    },

    // Kida - Protector of Atlantis: When you play this character, all characters
    // get -3 strength until the start of your next turn.
    kida: {
        type: "Triggered",
        trigger: { event: "Play", card: "Self" },
        effect: {
            type: "Modify Cards",
            cards: { zone: "Play", cardType: "Character" },
            modifier: { stat: "Strength", amount: -3 },
            duration: { until: "Start Of Next Turn", player: "You" },
        },
    },

    // Grumpy - Bad-Tempered: Your other Seven Dwarfs characters get +1 strength.
    grumpy: {
        type: "Static",
        rule: {
            type: "Modify Cards",
            cards: {
                zone: "Play", player: "You", cardType: "Character",
                where: { classification: "Seven Dwarfs" }, exclude: "Self",
            },
            modifier: { stat: "Strength", amount: 1 },
        },
    },

    // Lucky Dime: Exert, pay 2 ink — Choose a character of yours and gain lore
    // equal to their lore value.
    luckyDime: {
        type: "Activated",
        cost: [{ type: "Exert", cards: "Self" }, { type: "Ink", amount: 2 }],
        effect: {
            type: "Choose Cards",
            from: { zone: "Play", player: "You", cardType: "Character" },
            count: 1,
            effect: {
                type: "Gain Lore", player: "You",
                amount: { stat: "Lore", card: "Selected Cards" },
            },
        },
    },

    // Rapunzel - Gifted with Healing: When you play this character, remove up to
    // 3 damage from one of your characters. Draw for each damage actually removed.
    rapunzelHealing: {
        type: "Triggered",
        trigger: { event: "Play", card: "Self" },
        effect: {
            type: "Choose Cards",
            from: { zone: "Play", player: "You", cardType: "Character" },
            count: 1,
            effect: {
                type: "Sequence",
                effects: [
                    { type: "Remove Damage", cards: "Selected Cards", amount: { upTo: 3 } },
                    { type: "Draw", player: "You", amount: { result: "Damage Removed" } },
                ],
            },
        },
    },

    // Rapunzel - Ready for Adventure: Support generates one-use damage prevention.
    // It lasts until your next turn even if Rapunzel leaves play.
    rapunzelProtection: {
        type: "Triggered",
        trigger: { event: "Chosen For Support", card: { zone: "Play", player: "You", cardType: "Character" } },
        effect: {
            type: "Modify Cards", cards: { event: "Card" },
            modifier: { preventDamage: "Next" },
            duration: { until: "Start Of Next Turn", player: "You" },
        },
    },

    johnSilver: {
        type: "Triggered",
        trigger: { anyOf: [{ event: "Play", card: "Self" }, { event: "Quest", card: "Self" }] },
        effect: {
            type: "Choose Cards", from: { zone: "Play", player: "Opponents", cardType: "Character" }, count: 1,
            effect: {
                type: "Modify Cards", cards: "Selected Cards", modifier: { gainKeyword: "Reckless" },
                duration: { duringNextTurn: { ownerOf: "Selected Cards" } },
            },
        },
    },
    maleficent: {
        type: "Triggered",
        trigger: { event: "Draw", player: "You", when: { duringTurnOf: "You" } },
        effect: {
            type: "Optional", effect: {
                type: "Choose Cards", from: { zone: "Play", cardType: "Character" }, count: 1,
                effect: {
                    type: "Choose Cards", from: { zone: "Play", player: "Opponents", cardType: "Character" }, count: 1,
                    effect: { type: "Move Damage", from: "Parent Selected Cards", to: "Selected Cards", amount: 1 },
                },
            },
        },
    },
    leviathan: {
        type: "Triggered",
        trigger: {
            event: "Play", card: "Self",
            when: { value: { countEvents: { event: "Move Card", to: "Discard", player: "You" }, during: "This Turn" }, is: { atLeast: 2 } },
        },
        effect: {
            type: "Optional", effect: {
                type: "Choose Cards", from: { zone: "Play", player: "Opponents", cardType: "Character" }, count: "Any",
                where: { value: { sum: { stat: "Strength", cards: "Selected Cards" } }, is: { atMost: 10 } },
                effect: { type: "Banish", cards: "Selected Cards" },
            },
        },
    },
    bruno: {
        type: "Activated", cost: [{ type: "Exert", cards: "Self" }],
        effect: {
            type: "Sequence", effects: [
                { type: "Name Card" },
                { type: "Reveal", cards: { zone: "Deck", player: "You", take: 1 } },
                {
                    type: "Conditional",
                    if: { every: { result: "Revealed Cards" }, where: { namedCard: "Named Card" } },
                    then: {
                        type: "Sequence", effects: [
                            { type: "Move Card", cards: { result: "Revealed Cards" }, to: "Hand" },
                            { type: "Gain Lore", player: "You", amount: 3 },
                        ],
                    },
                    otherwise: { type: "Move Card", cards: { result: "Revealed Cards" }, to: "Deck", position: "Top" },
                },
            ],
        },
    },
    rc: {
        type: "Static",
        rule: { type: "Additional Cost", cards: "Self", for: ["Quest", "Challenge"], cost: [{ type: "Ink", amount: 1 }] },
    },
    dale: {
        type: "Static",
        rule: { type: "Challenge Damage", cards: { zone: "Play", player: "You", cardType: "Character" }, stat: "Willpower" },
    },
    jessie: {
        type: "Triggered",
        trigger: { event: "Play", player: "You", when: { value: { event: "Ink Paid" }, is: { atMost: 2 } } },
        effect: {
            type: "Choose Cards", from: { zone: "Play", player: "Opponents", cardType: "Character" }, count: 1,
            effect: { type: "Modify Cards", cards: "Selected Cards", modifier: { stat: "Strength", amount: -1 }, duration: { until: "Start Of Next Turn", player: "You" } },
        },
    },

    // A paid discard cost is selected and paid before the activated effect resolves.
    discardCost: {
        type: "Activated",
        cost: [{
            type: "Choose Cards", from: { zone: "Hand", player: "You" }, count: 1,
            cost: [{ type: "Discard", cards: "Selected Cards" }],
        }],
        effect: { type: "Draw", player: "You", amount: 1 },
    },

    // Keyword parameters are enforced instead of being optional on every keyword.
    evasive: { type: "Keyword", keyword: { name: "Evasive" } },
    resist: { type: "Keyword", keyword: { name: "Resist", amount: 2 } },
    shift: { type: "Keyword", keyword: { name: "Shift", cost: [{ type: "Ink", amount: 3 }] } },
    merlinBottomDraw: {
        type: "Triggered", trigger: { event: "Play", card: "Self" },
        effect: { type: "Optional", effect: { type: "Draw", player: "You", amount: 1, from: "Bottom" } },
    },
    rozTopCard: {
        type: "Static", rule: { type: "Reveal Cards", cards: { zone: "Deck", player: "Opponents", take: 1 } },
    },
    sorcerersTowerMovement: {
        type: "Static", rule: { type: "Alternate Cost", for: "Move", location: "Self", cost: [],
            cards: { zone: "Play", player: "You", cardType: "Character", where: { name: "Magic Broom" } } },
    },
    princeCharmingChallengers: {
        type: "Static", rule: { type: "Modify Players", players: "All",
            modifier: { challengeLimit: 1, count: "Characters", players: "All" } },
    },
    friarTuckLargestHand: {
        type: "Triggered", trigger: { event: "Play", card: "Self" },
        effect: { type: "For Each Player", players: { from: "All",
            rank: { order: "Highest", by: { count: { zone: "Hand", player: "Selected Player" } } },
        }, effect: { type: "Choose Cards", from: { zone: "Hand", player: "Selected Player" }, count: 1, player: "Selected Player",
            effect: { type: "Discard", cards: "Selected Cards" } },
        },
    },
    rakshaMovement: {
        type: "Static", limit: { perTurn: 1, count: "Uses" }, rule: { type: "Conditional", if: { duringTurnOf: "You" },
            then: { type: "Modify Cost", cards: "Self", for: "Move", amount: -1, optional: true } },
    },
    daleMillThenDebuff: {
        type: "Triggered", trigger: { event: "Play", card: "Self" }, effect: { type: "Optional", effect: { type: "Do Then",
            do: { type: "Move Card", cards: { zone: "Deck", player: "You", take: 3 }, to: "Discard" },
            then: { type: "Choose Cards", from: { zone: "Play", cardType: "Character" }, count: 1,
                effect: { type: "Modify Cards", cards: "Selected Cards", modifier: { stat: "Strength", amount: -3 },
                    duration: { until: "Start Of Next Turn", player: "You" } },
            },
        } },
    },
} satisfies Record<string, Ability>;
