# Tests

Gameplay tests use `ScriptedPlayer`, a test-only implementation of the same
`PlayerController` used by bots and the UI. Build a normal `GameState` fixture,
give each seat its own script, and run `playGame` with `from` and a turn limit.
The runner still processes turn start, payments, triggers and turn end.

```ts
const player = new ScriptedPlayer()
    .action((action) => action.type === "Play" && sameCard(action.card, character))
    .on("Pay Cost", (request) => {
        expect(request.cost).toEqual([{ type: "Ink", amount: 3 }]);
        expect(request.ink[0].cards).toHaveLength(3);
        return {
            type: "Decision",
            answer: {
                type: "Pay Cost",
                pay: true,
                payment: [{ type: "Ink", player: 1, cards: request.ink[0].cards }],
            },
        };
    })
    .action((action) => action.type === "End Turn");
```

Each request needs an explicit step, even a mandatory payment or a choice with
only one option. Use ordinary assertions inside `on` callbacks to check candidates,
limits, prices and the player's filtered view. `action` requires exactly one match
and resolves its request-local option number. If several prices or targets match,
use `on("Action", ...)` to inspect the full options and choose explicitly.

Unexpected requests, rejected answers and unused steps fail the test. Unused steps
are checked automatically at test completion. An empty script is useful for a seat
that should receive observations but no questions. Updates are available on
`player.updates` for ordinary assertions. Check authoritative outcomes on the
runner's returned record, not through a controller that can see hidden state.

See `engine/reference-scenarios.test.ts` for movement, shared action effects and
end-of-turn examples. Random outcomes are the runner's responsibility, not player
choices. Use a fixed seed when relevant. For exact shuffle outcomes, invalid
engine inputs or isolated instructions, keep direct resolution tests.

Instruction-level tests call `startEffect` or `startAction` directly and use
`resolvePlayers` to deliver filtered requests to their scripted controllers.
Static-rule tests query `Rules` directly and need no controller. These tests keep
their original scope. An isolated instruction does not claim to test a printed
trigger, its timing or its activation cost.

`resolvePlayers` never chooses an answer. Mandatory payments, forced card choices,
optional instructions, trigger order and amount choices all need explicit script
steps. Exact random outcomes are supplied separately. `untilAction: true` pauses
at the next turn-action boundary after all scripts are consumed, not at decisions.
A multi-player joint instruction needs an explicit test coordinator through
`joint`. That coordinator is for isolated instruction tests, not a change to the
normal runner's supported interactions.

The helpers in `player/fixtures.ts` only construct fixture cards and read state
or rule queries. They do not own game execution or supply choices. Each test
keeps its own normal `GameState`, catalog overrides and live resolutions.

`npm run abilities` creates missing failing stubs using `ScriptedPlayer`. Existing
test bodies are never regenerated. Only the marked card list is updated, so manual
assertions and prototype selection remain intact.

The legacy harness and its one-time migration commands have been retired.
All remaining harness-based files were converted while retaining their manually
established expected values, effect IDs and generated card-list markers. Originals
are retained in `temp/all-test-originals`, and the retired migration tools are
in `temp/test-migration-tools`. Future effects use `npm run abilities`, not the
completed reference migration.
