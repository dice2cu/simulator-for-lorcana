import { startAction, startTurn } from './engine';
import type { EngineOptions } from './engine';
import type { GameState } from '../model/game-state';
import type { Turn, TurnStep } from '../model/turn';
import type { Resolution } from './resolution';

/** Reconstructs one action from its base position and accepted input prefix. */
export function resumeAction(position: GameState, prefix: readonly TurnStep[], options: EngineOptions = {}): Resolution {
    const [first, ...remaining] = prefix;
    if (first?.type !== 'Action') throw new Error('An action prefix must begin with an action');
    const resolution = startAction(position, first.action, options);
    for (const step of remaining) resolution.submit(step);
    return resolution;
}

/** Reconstructs a completed turn or an unfinished prefix from its original position. */
export function resumeTurn(position: GameState, prefix: readonly TurnStep[], options: EngineOptions = {}): Resolution {
    const resolution = startTurn(position, options);
    for (const step of prefix) resolution.submit(step);
    return resolution;
}

/** Requires the record to finish the turn, with no missing or surplus inputs. */
export function applyTurn(position: GameState, turn: Turn, options: EngineOptions = {}): GameState {
    const resolution = resumeTurn(position, turn.steps, options);
    const result = resolution.result;
    if (!result) throw new Error('Turn record is incomplete');
    return result;
}
