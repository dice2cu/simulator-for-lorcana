import { getCard } from "../../cards";
import type { BotSetup } from "../../model/bot";
import type { CardState, GameState, PlayerPosition } from "../../model/game-state";
import type { CardIdentifier, PlayerNumber } from "../../model/identity";
import type { DeckListEntry, PlayerActionDescription } from "../../model/player-interaction";
import { createBot } from "../../search/bots";
import { playGame, type GameRecord, type Seat } from "../../player/runner";

/** Inert draws: uninkable and too expensive to play, so they do not change a scenario's choices. */
export const FILLER = "Chernabog - Evildoer";

export type Placed = string | { card: string; exerted?: boolean; damage?: number; drying?: boolean };

export interface Side {
    lore?: number;
    hand?: readonly string[];
    /** Top first. Defaults to filler. */
    deck?: readonly string[];
    play?: readonly Placed[];
    /** Ready ink cards. */
    ink?: number;
    discard?: readonly string[];
    turnsTaken?: number;
}

/** A position at the start of a turn, built from card names. */
export class Scenario {
    private serial = 0;
    readonly state: GameState;

    constructor(one: Side, two: Side, player: PlayerNumber = 1) {
        this.state = { turn: { number: 7, player }, players: { 1: this.side(one), 2: this.side(two) } };
    }

    private card(name: string): CardIdentifier {
        if (!getCard(name)) throw new Error(`Unknown card ${name}`);
        return { fullName: name, i: ++this.serial };
    }

    private side(side: Side): PlayerPosition {
        return {
            lore: side.lore ?? 0,
            turnsTaken: side.turnsTaken ?? 3,
            deck: (side.deck ?? Array<string>(15).fill(FILLER)).map((name) => this.card(name)),
            hand: (side.hand ?? []).map((name) => this.card(name)),
            play: (side.play ?? []).map((placed): CardState => {
                const entry = typeof placed === "string" ? { card: placed } : placed;
                return { card: this.card(entry.card), ...(entry.exerted ? { exerted: true } : {}), ...(entry.damage ? { damage: entry.damage } : {}), ...(entry.drying ? { drying: true } : {}) };
            }),
            discard: (side.discard ?? []).map((name) => this.card(name)),
            inkwell: Array.from({ length: side.ink ?? 0 }, () => ({ card: this.card(FILLER), exerted: false })),
        };
    }

    /** The first physical card with this name in a player's position. */
    find(state: GameState, player: PlayerNumber, name: string): { zone: string } | undefined {
        const position = state.players[player];
        if (!position) return undefined;
        if (position.play.some((entry) => entry.card.fullName === name)) return { zone: "Play" };
        if (position.hand.some((card) => card.fullName === name)) return { zone: "Hand" };
        if (position.discard.some((card) => card.fullName === name)) return { zone: "Discard" };
        if (position.inkwell.some((ink) => ink.card.fullName === name)) return { zone: "Inkwell" };
        if (position.deck.some((card) => card.fullName === name)) return { zone: "Deck" };
        return undefined;
    }
}

export interface Played {
    readonly record: GameRecord;
    readonly final: GameState;
    /** Public actions in order, as the first seat observed them. */
    readonly actions: readonly PlayerActionDescription[];
}

/**
 * Plays the scenario's turn with real bots through the runner. Each seat gets
 * only its deck list unless a setup says otherwise.
 */
export function play(
    scenario: Scenario,
    decks: Readonly<Record<1 | 2, readonly DeckListEntry[]>>,
    setups: Partial<Record<1 | 2, Partial<Omit<BotSetup, "player" | "deck">>>> = {},
    turns = 1,
): Played {
    const actions: PlayerActionDescription[] = [];
    const seats: Seat[] = ([1, 2] as const).map((player) => ({
        player,
        deck: decks[player],
        controller: createBot({ player, deck: decks[player], settings: { seed: 1, search: { nodes: 300, samples: 1 } }, ...setups[player] }),
    }));
    const record = playGame(seats, {
        seed: 3,
        from: scenario.state,
        turns,
        trace: (player, update) => {
            if (player !== 1) return;
            for (const observation of update.observations) if (observation.type === "Action") actions.push(observation.action);
        },
    });
    return { record, final: record.final, actions };
}

/** A deck list covering the cards a scenario uses plus filler, as the bot's own list. */
export function list(...names: string[]): DeckListEntry[] {
    const counts = new Map<string, number>([[FILLER, 4]]);
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts].map(([fullName, count]) => ({ fullName, count: Math.max(count, 4) }));
}
