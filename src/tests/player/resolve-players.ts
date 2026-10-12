import type { Resolution } from "../../engine/resolution";
import type { GameState } from "../../model/game-state";
import type { PlayerNumber } from "../../model/identity";
import type { RandomOutcome, Decision } from "../../model/turn";
import { projectRequest } from "../../player/requests";
import { projectState, sight, type Glimpse } from "../../player/projection";
import { placements, cardKey } from "../../player/locations";
import { ScriptedPlayer } from "./scripted-player";

export function finished(live: Resolution, untilAction = false): GameState {
    const state = live.result ?? (untilAction && live.request?.type === "Action" ? live.position : undefined);
    if (!state) throw new Error("Resolution did not finish");
    return state;
}

/** Drives an isolated engine resolution through real, filtered controller requests. No answers are inferred. */
export function resolvePlayers(
    live: Resolution,
    players: Partial<Record<PlayerNumber, ScriptedPlayer>>,
    options: { random?: readonly RandomOutcome[]; untilAction?: boolean; joint?: ScriptedPlayer; decisions?: Decision[] } = {},
): void {
    let randomIndex = 0,
        seen = 0;
    const glimpses: Glimpse[] = [];
    const controllers = [...Object.values(players), ...(options.joint ? [options.joint] : [])];
    const track = (): void => {
        const position = live.position;
        if (!position) throw new Error("Resolution has no position");
        const places = placements(position);
        for (const observation of live.observations.slice(seen))
            for (const card of observation.cards) {
                const place = places.get(cardKey(card));
                if (place) glimpses.push({ card, place, ...(observation.players ? { players: observation.players } : {}) });
            }
        seen = live.observations.length;
    };
    track();
    while (live.request) {
        const request = live.request;
        if (request.type === "Action" && options.untilAction && controllers.every((controller) => controller.done)) break;
        if (request.type === "Shuffle" || request.type === "Random Cards") {
            const outcome = options.random?.[randomIndex++];
            if (!outcome) throw new Error(`Unexpected randomness: ${JSON.stringify(request)}`);
            live.submit({ type: "Random", outcome });
        } else {
            if (request.type !== "Action") options.decisions?.push(request);
            const participants = typeof request.player === "number" ? [request.player] : request.player.together;
            const controller = participants.length === 1 ? players[participants[0]] : options.joint;
            if (!controller) throw new Error(`No scripted controller for ${JSON.stringify(request.player)}`);
            const state = live.position,
                rules = live.rules;
            if (!state || !rules) throw new Error("Resolution has no live state or rules");
            // A joint instruction is answered by an explicitly supplied test coordinator.
            const views = participants.map((player) => sight(state, player, glimpses, rules.revealedCards()));
            const sees = (card: Parameters<(typeof views)[number]>[0]) => views.some((view) => view(card));
            const projected = projectRequest(request, rules, sees);
            const view = projectState(state, sees);
            const answer = controller.decide(view, projected.request);
            live.submit(projected.toStep(answer));
        }
        track();
    }
    if (randomIndex !== (options.random?.length ?? 0)) throw new Error("Unused scripted random outcomes");
    for (const controller of controllers) controller.assertDone();
}
