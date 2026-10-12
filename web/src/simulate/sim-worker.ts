// Plays simulation jobs posted by the page's pool, one at a time.
import { runGame, type Deck } from "../simulator";
import type { WorkerInput } from "./pool";

const scope = globalThis as unknown as { onmessage: (event: MessageEvent<WorkerInput>) => void; postMessage(message: unknown): void };
let decks: readonly Deck[] = [];

scope.onmessage = ({ data }) => {
    if (data.type === "decks") decks = data.decks;
    else scope.postMessage(runGame(decks, data.job));
};
