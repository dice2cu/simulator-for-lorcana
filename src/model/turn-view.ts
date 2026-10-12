
import type { CardIdentifier } from "./identity";
import type { DecisionAnswer, PlayerAction } from "./turn";

/**
 * Turn history with private inputs removed for one player. This is not an
 * executable Turn. Producing it may require executing the original turn against
 * its starting state to establish what was visible at each step.
 */
export interface TurnView {
    steps: TurnStepView[];
}

/**
 * Retains the authoritative step vocabulary, not request-local choice handles.
 * Omit an action or answer if any of its contents are private. Omit the whole
 * step if even its occurrence is private. Omit payloads containing internal rule
 * or event slots too. Stable card identities may be recognized when visible again,
 * but hidden current placement is not exposed.
 */
export type TurnStepView =
    | { type: "Action"; action?: PlayerAction }
    | { type: "Decision"; answer?: DecisionAnswer }
    | { type: "Random"; outcome: { type: "Shuffle" } }
    /** Cards are included only when the entire selected result was visible. */
    | { type: "Random"; outcome: { type: "Random Cards"; cards?: CardIdentifier[] } };
