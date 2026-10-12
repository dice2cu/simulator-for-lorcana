import type { BotSetup } from "../model/bot";
import { HeuristicBot } from "../bot/heuristic-bot";
import { HypotheticalInsight } from "./insight";

/** Wires bot policy to trusted hypothetical-position queries built only from views. */
export function createBot(setup: BotSetup): HeuristicBot {
    return new HeuristicBot(setup, (view, viewer, hypothesis) => HypotheticalInsight.fromView(view, viewer, hypothesis));
}
