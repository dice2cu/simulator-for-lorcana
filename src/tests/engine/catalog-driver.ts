import { getDefaultPayment } from "../../engine/costs";
import type { Resolution } from "../../engine/resolution";
import type { EngineOptions } from "../../engine/rules";
import type { EffectSource, GameState } from "../../model/game-state";
import type { DecisionAnswer, TurnStep, PlayerAction } from "../../model/turn";

/** Smoke-test choices, not an AI strategy or an oracle for expected card outcomes. */
export function completeCatalogResolution(
    live: Resolution,
    source: EffectSource,
    options: EngineOptions,
    base?: GameState,
    chooseAction?: (actions: readonly PlayerAction[]) => PlayerAction,
    verifyConservation = true,
    choices: { last?: boolean; payOptional?: boolean; acceptOptional?: boolean } = {},
): void {
    const identities = (state: GameState): string[] =>
        Object.values(state.players)
            .flatMap((player) => [
                ...player.hand,
                ...player.deck,
                ...player.discard,
                ...(player.removed ?? []),
                ...player.inkwell.map((ink) => ink.card),
                ...player.play.flatMap((state) => [state.card, ...(state.under?.map((under) => under.card) ?? [])]),
            ])
            .map((card) => JSON.stringify([card.fullName, card.i]))
            .sort();
    const original = base && verifyConservation ? JSON.stringify(identities(base)) : undefined;
    const conserved = (): void => {
        if (!verifyConservation) return;
        const position = live.position;
        if (!position) throw new Error("Missing live position");
        if (original !== undefined && JSON.stringify(identities(position)) !== original) throw new Error("A physical card was lost, duplicated or invented");
    };
    conserved();
    let count = 0;
    while (live.request) {
        if (++count > 100) throw new Error("Resolution did not terminate");
        const request = live.request;
        let step: TurnStep;
        if (request.type === "Shuffle" || request.type === "Random Cards")
            step = {
                type: "Random",
                outcome: { type: request.type, cards: request.type === "Shuffle" ? request.cards : request.cards.slice(0, request.count) },
            };
        else if (request.type === "Action") step = { type: "Action", action: chooseAction ? chooseAction(request.actions) : request.actions[0] };
        else {
            let answer: DecisionAnswer;
            switch (request.type) {
                case "Optional":
                case "Optional Cost Rule":
                    answer = { type: request.type, accept: choices.acceptOptional ?? true };
                    break;
                case "Choose Cards":
                    answer = {
                        type: request.type,
                        cards: (choices.last ? [...request.cards].reverse() : request.cards).slice(0, Math.max(request.min, Math.min(1, request.max))),
                    };
                    break;
                case "Order Cards":
                    answer = { type: request.type, cards: choices.last ? [...request.cards].reverse() : request.cards };
                    break;
                case "Choose Player":
                    answer = { type: request.type, player: request.players[choices.last ? request.players.length - 1 : 0] };
                    break;
                case "Choose Mode":
                    answer = { type: request.type, mode: request.options[choices.last ? request.options.length - 1 : 0].mode };
                    break;
                case "Choose Trigger":
                    answer = { type: request.type, trigger: request.options[choices.last ? request.options.length - 1 : 0].reference };
                    break;
                case "Choose Replacement":
                    answer = { type: request.type, replacement: request.options[choices.last ? request.options.length - 1 : 0].reference };
                    break;
                case "Choose Amount":
                    answer = { type: request.type, amount: request.max };
                    break;
                case "Name Card":
                    answer = { type: request.type, name: "Hercules" };
                    break;
                case "Distribute Damage Removal":
                    answer = { type: request.type, amounts: [] };
                    break;
                case "Pay Cost": {
                    if (request.optional && !choices.payOptional) {
                        answer = { type: request.type, pay: false };
                        break;
                    }
                    const current = live.position;
                    if (!current) throw new Error("Missing live position");
                    const payment = getDefaultPayment(current, request, source, options);
                    if (!payment && request.optional) {
                        answer = { type: request.type, pay: false };
                        break;
                    }
                    if (!payment) throw new Error("Fixture cannot construct a complete payment");
                    answer = { type: request.type, pay: true, payment };
                    break;
                }
            }
            step = { type: "Decision", answer };
        }
        live.submit(step);
        conserved();
    }
    if (!live.result) throw new Error("Resolution did not produce a position");
}
