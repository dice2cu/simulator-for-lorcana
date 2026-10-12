import { onTestFinished } from "vitest";
import type { GameStateView } from "../../model/game-state-view";
import type { PlayerActionDescription, PlayerAnswer, PlayerController, PlayerRequest, PlayerUpdate } from "../../model/player-interaction";

/** A strict test controller. Every request consumes one explicit script step. */
export class ScriptedPlayer implements PlayerController {
    readonly updates: PlayerUpdate[] = [];
    private readonly steps: { type: PlayerRequest["type"]; respond: (request: PlayerRequest, state: GameStateView) => PlayerAnswer }[] = [];
    private next = 0;

    get done(): boolean {
        return this.next === this.steps.length;
    }

    constructor() {
        onTestFinished(() => this.assertDone());
    }

    /** Check the offered choices with normal assertions before returning an answer. */
    on<T extends PlayerRequest["type"]>(type: T, respond: (request: Extract<PlayerRequest, { type: T }>, state: GameStateView) => PlayerAnswer): this {
        this.steps.push({
            type,
            respond: (request, state) => {
                if (request.type !== type) throw new Error(`Expected ${type}, received ${request.type}`);
                return respond(request as Extract<PlayerRequest, { type: T }>, state);
            },
        });
        return this;
    }

    /** Select exactly one legal action by its meaning, never by its option number. */
    action(matches: (action: PlayerActionDescription) => boolean): this {
        return this.on("Action", (request) => {
            const options = request.actions.filter(({ action }) => matches(action));
            if (options.length !== 1) throw new Error(`Expected exactly one matching action, received ${options.length}: ${JSON.stringify(request)}`);
            return { type: "Action", option: options[0].option };
        });
    }

    observe(update: PlayerUpdate): void {
        this.updates.push(update);
    }

    decide(state: GameStateView, request: PlayerRequest, error?: string): PlayerAnswer {
        if (error) throw new Error(`Scripted answer was rejected: ${error}`);
        const step = this.steps[this.next];
        if (!step || step.type !== request.type)
            throw new Error(`Unexpected request at step ${this.next + 1}. Expected ${step?.type ?? "no more requests"}: ${JSON.stringify(request)}`);
        const answer = step.respond(request, state);
        this.next++;
        return answer;
    }

    /** Also checked automatically when the test finishes. */
    assertDone(): void {
        if (this.next !== this.steps.length)
            throw new Error(`${this.steps.length - this.next} unused scripted request(s), next: ${this.steps[this.next]?.type}`);
    }
}
