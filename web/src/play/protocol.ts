import type { DeckListEntry, GameOutcomeRecord, GameStateView, PlayerAnswer, PlayerNumber, PlayerRequest, PlayerUpdate } from "../simulator";

export interface SeatSetup {
    readonly name: string;
    readonly deck: readonly DeckListEntry[];
    readonly controller: "Human" | "Bot";
}

export interface GameSetup {
    /** Player 1, then player 2. */
    readonly seats: readonly [SeatSetup, SeatSetup];
    readonly first: PlayerNumber;
    readonly seed: number;
    /** Bot search budget. 0 turns search off. */
    readonly nodes: number;
    /** Milliseconds a bot waits before each action, so its turns can be followed. */
    readonly botDelay: number;
}

/** From the game worker. Human seats receive only their own updates and requests. */
export type GameMessage =
    | { readonly type: "update"; readonly player: PlayerNumber; readonly update: PlayerUpdate }
    | { readonly type: "request"; readonly player: PlayerNumber; readonly state: GameStateView; readonly request: PlayerRequest; readonly error?: string }
    | { readonly type: "end"; readonly outcome?: GameOutcomeRecord; readonly error?: string };

/** To the game worker: one start, then an answer to each request. */
export type GameCommand = { readonly type: "start"; readonly setup: GameSetup } | { readonly type: "answer"; readonly answer: PlayerAnswer };
