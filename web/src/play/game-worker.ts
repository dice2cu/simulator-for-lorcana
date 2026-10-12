// Runs one game off the page's thread. The page starts a new worker for each game.
import type { PlayerAnswer } from "../simulator";
import { hostGame } from "./host";
import type { GameCommand } from "./protocol";

const scope = globalThis as unknown as { onmessage: (event: MessageEvent<GameCommand>) => void; postMessage(message: unknown): void };
let pending: ((answer: PlayerAnswer) => void) | undefined;

scope.onmessage = ({ data }) => {
    if (data.type === "start") {
        void hostGame(
            data.setup,
            (message) => scope.postMessage(message),
            () => new Promise((resolve) => (pending = resolve)),
        );
        return;
    }
    const resolve = pending;
    pending = undefined;
    resolve?.(data.answer);
};
