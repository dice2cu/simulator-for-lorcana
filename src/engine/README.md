# Engine integration

The engine executes embedded parsed rules against GameState.

`engine.ts` coordinates turns, events and resolution. Movement of physical cards
and stacks lives in `movement.ts`. Damage and healing instructions live together
in `effect-damage.ts`, while the evaluator owns simultaneous-damage batches and
cleanup timing. Action dispatch delegates to a separate handler for each action.

Callers hold positions and choose which resulting position to use:

```ts
const live = startAction(position, { type: 'Play', player: 1, card });
// Inspect live.request and answer through live.submit(step).
// When complete, live.result contains the resulting position.
// live.turn contains only accepted inputs.
// live.position exposes this branch's immutable current position.
```

For asynchronous UI, AI or test adapters:

```ts
const next = await drive(startAction(position, { type: 'Play', player: 1, card }), decide);
```

startEffect uses the same evaluator for isolated effects. resumeAction reconstructs
a single-action prefix.

For an actual turn, use startTurn(position, options). It performs start processing,
then yields Action requests containing legal intentions. Payment, target and random
requests follow each intention. End Turn performs end processing and advances the
position to the upcoming turn.

startGame(position, options) prepares fresh decks with explicit shuffle outcomes,
draws seven-card opening hands and offers one hand alteration per player. Feed its
result to startTurn. Setup choices use the same accepted-input record and validation.

resumeTurn(position, steps, options) reconstructs an unfinished prefix from its
original position. applyTurn(position, turn, options) requires a complete record.
It rejects missing or surplus inputs. These use the engine itself, not a separate
patch interpreter. Turn-local ink and ability limits are reconstructed from inputs.
Do not chain isolated startAction calls to enforce whole-turn limits.

Resolution.outcome reports a lore victory or an empty deck at turn end. It is execution output,
not a property added to GameState. A replay reconstructs it from the same turn.
An empty deck during a turn is not a loss. Callers must not continue after an outcome.
`Resolution.rules` reads the live position together with its current turn history.
Use it for contextual queries such as discounts after damage or playing a song.
`Resolution.observations` exposes private Look results and public Reveal results.
`Resolution.rules.revealedCards()` queries cards made public by continuous rules,
such as Roz revealing opponents' top cards. It updates with the position rather
than retaining an earlier reveal.
These are execution outputs, not extra fields attached to physical cards.
In a continuing multiplayer game, deck-out removes the losing player's seat and
cards. Timed static effects expire where that player's next turn would have occurred.

See [the model guide](../model/README.md) for result scoping and turn contracts,
and [the test guide](../tests/README.md) for executable examples.

## Current coverage

Complete turns support inking, normal play of all card types, singing, questing,
challenges, movement, printed/granted Shift including Duo and Combo, Boost and
activated costs with nested card selections. Printed alternate prices, optional
and limited discounts, free activations and collective ink/lore payments are supported.
Effect-driven Shift, source-provided alternate costs and limited movement discounts
use the same action transitions and pricing queries. Player permissions also allow
play or inking from explicitly permitted zones.
Shared queries evaluate selectors, filters, conditions, amounts, stat modifiers,
continuous card rules, entry changes, player limits and play discounts. Trigger occurrences use deterministic
registry slots and a player-ordered bag. Sources and event-time positions survive
departure. Granted abilities retain their own occurrence slots. Damage cleanup
banishes lethal cards in a batch, after proposed-event replacements are resolved.

Instructions include deck movement and ordering, random selection and shuffling,
conditions, iteration, results, stat/keyword changes, created listeners, basic
delays, generated play, control changes, damage and shared healing. Specific
variations still reject unsupported mechanics. A switch branch is not evidence
that every use of that instruction is supported.

Tests cover independent branches, invalid-input retries, serialized prefixes,
dependent healing results, resolving-action sources and immutable snapshots.
The browser-bundle test exercises the public API without Node or fetch.
Tests also exercise 1,000 seeded simple-character games, 30 mechanic-rich games,
256 mixed-catalog games and all thirteen reference decks, with card conservation
and serialized full-turn reconstruction. Catalog action sweeps exercise alternate
decisions and optional payments as well as the first available choices.
The engine runs games from setup through an outcome using the embedded catalog.
Some general-model combinations that no current card uses are deliberately rejected.
Tests provide regression and execution coverage,
not proof that every possible interaction is correct.
All 2,224 reference files have adapted tests. Run `npm test` for current results.

## Reference test migration

The tests in src/tests/card-abilities/ preserve the original effect IDs, setup
values and expected outcomes. Do not derive new expectations from engine output.

Some old fixtures start with lethal damage. Preserve those isolated effect
expectations, but do not treat the fixture as a legal whole-turn position.

The reference migration is complete and its one-time converter has been retired.
The adapted tests use normal game states, direct rule queries and scripted player
controllers, with their original expected values preserved. See
[the test guide](../tests/README.md) for full-game and isolated-instruction patterns.

Run `npm run abilities` separately after updating cards to create missing failing
stubs and refresh only the lists between the generated card-list comments.
It uses temp/allCards.json and keeps the original effect hashes and filenames.
Different printed ability titles with the same effect share a test, and the
first card in the sorted list remains the prototype. No completed test body or
expected value is regenerated. Obsolete tests are reported, not deleted.

The ability generator runs only when requested, never implicitly as part of
npm test or the card-update command.
