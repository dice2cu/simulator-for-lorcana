# Ability/effect model verification

Reviewed October 5, 2026. Recommendation: proceed to focused real-engine integration, but do
not replace the running engine or commit to a full catalog conversion yet.

## Evidence and scope

- Local allCards.json: format 2.3.4, generated July 17, 2026; 3,226 entries,
  2,547 distinct full names, and 2,310 distinct instructions after collapsing
  whitespace. Instructions include action effects and ability effect/fullText
  entries; keyword reminder text is included. These counts are not a coverage score.
- Reviewed the TCG basic, movement, modifier, control-flow, scry, combined-effect,
  and amount definitions, plus specific Arthur, Daisy, Fairy Godmother and Woody
  card definitions under the locally supplied Lorcana workspace.
- Existing authored examples: 53 abilities, 15 action cards and 2 other card
  rules. All pass definition scope validation.
- Added twenty-four real-text checks, verifying their instructions against the
  local catalog, scope-checking the definitions, and checking JSON round-trips.
- TypeScript checking and 214 model tests pass across seven files.
- Audited every named member of the supplied TCG Effect and StaticEffect unions:
  108 distinct names, of which 105 map into 47 canonical fixture families; no missing or
  extra member names. The three unused by any card (set stat, damage redirection,
  created replacements) were later removed from the model. This is not exhaustive field/card or gameplay verification.
- Scanned type tags in 3,264 non-test/non-i18n TypeScript files in the supplied
  TCG card tree to locate mechanics used by definitions, not just declared types.
  This is a source-file inventory, not a count of verified cards.

The whole catalog was scanned to locate unusual mechanics. It was not converted
or individually verified. A definition passing the scope checker establishes
reference availability, not equivalence to its printed text or correct execution.
TCG implementations are useful comparisons, not authoritative rulings.

Deck-copy rules are now Deck Construction entries, covering Dalmatian Puppy,
Microbots and The Glass Slipper without filtering or changing catalog indexes.
The temporary catalog filtering helper was removed. A new-format parser and its
unsupported-instruction report are now implemented in `src/parser`. Every catalog
printing converts and passes the scope checker. Singing rules are action-only,
Sing Together cannot be suppressed as a character keyword, and UsesLimit and
OccurrencesLimit name the existing per-turn counting forms directly.

GrantedAbility excludes deck-construction rules and simple/numeric keyword
abilities. Those keywords use gainKeyword, while Boost and Shift retain their
full definitions in gainAbility. Definition validation rejects noncanonical grants.

## Additional examples

| Card | Finding |
| --- | --- |
| Remember Who You Are | A chosen opponent and a hand-count difference express the counted-once draw amount. |
| Goliath - Clan Leader | Turn-event player, chosen discard and computed draw express the hand-size adjustment. The model currently binds the one event player through Choose Player; this is a singleton, not a strategic choice. |
| Woody - Helping a Friend | Conditional plus Sequence/Choose Mode expresses choosing both or one, with optional instructions in each mode. |
| Daisy Duck - Paranormal Investigator | A proposed inkwell-entry replacement can supply exerted entry before the event happens. This still needs a real evaluator test for entry timing, replacement recursion and simultaneous entries. |
| Fairy Godmother - Magical Benefactor | Under-zone selection, dependent banishment, the banished card's owner, public reveal and opponent-controlled play are expressible. A real execution test must establish declining play and empty-deck behavior. |
| I've Got a Dream | locationOf reads the selected character's actual location, without selecting another location. |
| Flynn Rider - High-Climbing Rogue | Chosen identifies the choosing opponent separately from the chosen card's owner. |
| Morph - Little Imitator | Can Shift Onto overrides base eligibility without inventing names or waiving payment/base count. |
| Belle - Always Reading | Shift cost rules constrain actual bases through onto; the discount is not global. |
| Meilin Lee - Superficially Obedient | A Play trigger matches onto: Self and modifies the incoming character; base sources are observed before being covered. |
| Arthur - Determined Squire | skipDrawStep skips the normal turn step without preventing card-effect drawing. |

These fixtures are in ../tests/engine/model-coverage.test.ts. They are focused
instruction excerpts, not full-card implementations. In particular, they do not
include every keyword or secondary ability on each card.

## Findings

The attached external review prompted removal of optional/continuation controls
from Play and optional from Pay Cost. Existing Optional and Do Then instructions
now express those behaviors, with examples and TCG fixtures updated. Card and
player restrictions/permissions have separate types in definitions and state.
Keyword families and readable numeric characteristics are declared once.
Repeat rejects combined times/until controls, and Look validates a single private
viewer. Regression checks cover these boundaries and continuation reference scopes.
These are format checks, not proof that play or payment executes correctly.

The external review decisions are recorded below. None of its model proposals
remain deferred. Execution tests are still needed because the running engine
does not use this format yet.

### External review decisions

| Proposal | Decision and reason |
| --- | --- |
| Remove PlayerChange.characters | Adopted. Create Rule with a live Modify Cards selector is the only stored rule for present and future characters. Atlantis now uses it. Kida still freezes its targets with the Modify Cards instruction. |
| Remove the Modify Players instruction | Not adopted. It fixes the recipients at resolution. A created Modify Players rule reevaluates its player selector. This distinction also exists between the Modify Cards instruction and rule. PlayerModifier still stores direct player changes. |
| Unify comparisons | Adopted. Conditions use `{ value, is: Comparison }`. Filters use the same Comparison vocabulary and operands. |
| Remove matches Any | Adopted. `{ every, where }` tests a nonempty set. Any matching card is expressed with exists and filter. There is no quantifier field. |
| Remove Play and Pay Cost optional/continuation shortcuts | Adopted. Optional and Do Then provide those behaviors. Atomic payment keeps its own success/failure branches. |
| Nest Replacement.action | Not adopted. The existing exclusive union already prevents combining replacement actions. Nesting adds a level without changing the allowed cases or execution contract. |
| Share keywords and characteristics | Adopted. SimpleKeyword, NumericKeyword and Characteristic are shared across the relevant definitions and state variants. Under is in the common event-selection union. |
| Replace sum/highest/lowest with aggregate | Not adopted. These are distinct operations with different empty-set behavior. Their readable operands already share Characteristic. An aggregate tag would not reduce evaluator work. |
| Use one limit shape everywhere | Partially adopted after the follow-up review. Per-turn limits share `{ perTurn, count }`. Activations and static action rules count Uses, triggers allow Uses or Occurrences, and replacements count Occurrences. Lifetime uses on created rules remains a separate decreasing budget. |
| Use Duration for Delay | Not adopted. Duration describes an active interval, including delayed starts and source departure. Delay describes one future execution boundary. Sharing the full type would allow nonsensical schedules such as whileInPlay. |
| Split card/player restrictions | Adopted in definitions and state. Card-only and player-only permissions are separate as well. |
| Separate authored/resolved instruction type hierarchies | Not adopted. Retain one expression schema for live rules, with concrete operands and explicit captures. Direct numeric state modifiers already use numbers rather than Amount. A recursive generic or mirrored hierarchy would spread through abilities, costs, selectors and conditions without replacing runtime scope checks. This is a deliberate tradeoff: TypeScript alone does not guarantee that a catalog lacks concrete identities or that stored rules have had their creating-scope captures lowered. |
| Arbitrary result labels | Not adopted. Fixed result names and nested selections preserve deterministic parsing and the user's requirement to avoid invented aliases. |
| Two-player-only model | Not adopted. Multiplayer remains a requirement. Singleton player selections can resolve without prompting, but group operands remain explicit. |
| Split the README into format and evaluator documents | Not adopted. Keep the format and its execution contract together, with an explicit implementation-status introduction and section headings. Another document would fragment the contract without reducing it. |
| Add ability.text | Not adopted. Original text belongs in the immutable card catalog and parser diagnostics, not duplicated in executable rules. |
| Add Look And Distribute | Not adopted. Look, Choose Cards, Move Card and difference already express destinations, ordering and remainder handling. Keep one compositional representation rather than a second movement/choice path. Water Has Memory remains the worked example. AI planning can consider the whole effect rather than requiring another opcode. |
| Build a separate evaluator pilot | Not adopted as a separate interpreter. Integrate these definitions into the real engine and verify representative cards there before broad catalog conversion. The scenario checklist below is retained as integration acceptance criteria, not another pending format proposal. |

These decisions settle the reviewed format choices. They do not establish that
every catalog instruction has been converted or that execution is correct.

The follow-up review also removed Sing Together from numeric character keywords,
specified dual-ink membership and union counting, limited player restriction
filters to Can't Play, and separated Free Ability's printed-title and Boost
selectors. Printed ability order is now an explicit parser contract. Original
text remains in the catalog. The new MAGICAL MIX fixture checks representability,
not execution of dual-ink counting in the proposed evaluator.

The latest pass validates singleton movement destinations and whileInPlay sources,
publishes Optional outputs (empty/zero if declined), and adds Baymax's literal
optional-healing/lore sequence. getModifiedStat verifies signed combination,
floors and nonnegative Strength/Lore reads without introducing timestamps;
conflicting hypothetical setters are rejected. Model examples now respect the
1–10 PlayerNumber range. JSDoc uses multiline comments with brief explanations
and catalog-checked card examples for non-obvious variants.
These changes do not integrate the definitions into the running engine.

The latest follow-up retains `{ card, player, kind }` source context on created
rules, replacements and triggers, as well as queued instructions and resolution
resolver scopes. Ordinary numeric modifiers do not store it. Serialization tests distinguish
identical delayed instructions from different sources after those sources leave
play. Single-player validation now covers chooser/actor fields, scalar player
expressions, next-turn durations and delayed boundaries. Known empty/grouped
operands are rejected, while dynamic queries remain an evaluator responsibility.
Created passive rules reject use limits, using the same check as printed static
rules. These are schema and validation checks, not execution tests.

October 5 follow-up: removed all model import cycles by moving shared identity
and classification declarations into dependency-free identity.ts and consolidating
CardRules/PlayRule into ability.ts. File count is unchanged. A regression test checks
the model import graph, including type-only imports. Entry damage rejects negative
literals; challenge expiry rejects known outside-challenge contexts without rejecting
actions that may be generated during a challenge. Corrected Reveal Inkwell's public
visibility fixture and removed the misleading hardcoded completeness count. Added
three actual-card examples for numeric "instead" instructions, without new schema
features. No once-per-game instruction was found in either local catalog; the model
does not implement that unused restriction, and a catalog check flags future wording.

1. **Draw-step gap represented.** Arthur - Determined Squire's instruction now
   uses skipDrawStep in player changes/modifiers. It must skip the turn step while
   permitting unrelated card-draw effects; executing that distinction remains
   an evaluator requirement.
2. **Corrected Name Card semantics.** The earlier README incorrectly required a
   full display name. Legal name matching excludes versions and supports the
   individual names of team cards. Updated the model comment and README to follow
   [Comprehensive Rules 5.2.6.1-5.2.6.3](https://files.disneylorcana.com/Comprehensive-Rules_2.2.0-EN.pdf).
   The types remain suitable; the catalog name matcher still needs implementation.
3. **Hardened definition validation.** Added checks for non-finite/fractional
   literals and negative up-to/repeat counts, plus a test rejecting triggering
   event references inside a later granted activation. These catch malformed
   definitions before an evaluator attempts to run them.
4. **Binding convenience is limited.** Singleton Choose Player currently binds an
   already determined player for reuse. An evaluator should advance it without a
   prompt. Do not introduce arbitrary variables just to avoid this representation.
5. **Independent grant counters are represented.** The engine rule registry gives each
   acquired ability its own turn-local entry. Entries remain after loss for pending
   triggers and are never merged by definition equality or object identity. Gained
   activations select an entry rather than copying instructions. Registration,
   retirement, counter consumption and static-provider lifecycle still need a real
   evaluator; serialization alone does not prove that implementation.
6. **Relationship gaps represented.** Added Chosen, locationOf, Shift-base events,
   Can Shift Onto and base-constrained Shift discounts. TCG provided useful examples
   of chosen events and location-relative amounts. Its permissive/overlapping
   representations were not copied. These additions still require gameplay tests.
7. **Persistence and numeric validation strengthened.** Negative literal payments,
   operation amounts and usage limits are rejected; signed stat/cost adjustments
   remain valid. Lasting player permissions/character rules and card restriction
   predicates require captures for creating-scope bindings. Direct numeric card
   changes are evaluated immediately rather than retained as live expressions.
8. **Broader TCG comparison completed.** See [TCG-COMPARISON.md](TCG-COMPARISON.md).
   Added base-name assignments, absolute stats, bottom draws, continuous public
   visibility, player ranking with ties, per-event snapshot reads, destination-
   constrained costs, optional limited static discounts and cause-preserving damage
   adjustment. Replacement candidates retain independent application flags.
   The TCG scan also found nonprinted shortcut abilities, which were not imported.
9. **Counter replay and replacement duplicates clarified.** Printed use counters
   now have append-only execution entries as well: catalog references remain the
   same across replay, but a pending trigger retains its old counter entry. Checked
   the current official rules, including 7.1.6 and 6.5.8. Independent replacement
   records do not permit duplicates to stack; unselected same-effect instances
   cease to exist. This remains an evaluator obligation, not executed by these
   serialization fixtures.

## Execution verification still required

A partial native evaluator now executes basic parsed effects. It does not yet
verify the broader mechanics below. No parallel toy interpreter was added.
Reference expectations must be preserved as the native evaluator gains coverage.

The evaluator pilot should use expected decisions and complete resulting positions
for at least these scenarios:

- Rapunzel: partial/zero healing and draw from actual removed damage.
- Madam Mim/Megara: force the available Or branch; never evade a mandatory branch
  through an unavailable choice.
- Chernabog/Fairy Godmother: dependent operations, original versus opposing player
  decisions, optional play and empty decks.
- Kida/Atlantis: frozen affected cards versus future entrants, expiry and source exit.
- Beast/Rapunzel/Daisy: replacements, repeated identical prevention, simultaneous
  damage and exerted inkwell entry.
- Ursula: generated action effects, action destination and bag order.
- Rourke: simultaneous departures and last-known characteristics.
- Bruno: team-card names, named-card scope and nonmatching names.
- Arthur: skip only the normal Draw step, including multiplayer turn boundaries.
- Flynn: actual choices trigger; random sampling, searching and payments do not.
- I've Got a Dream: use the selected character's exact location, including duplicate
  location cards in play and already-ready targets.
- Morph/Belle/Meilin: normal, classification, item-base and multi-base Shift variants;
  base-sensitive costs and pre-Shift trigger observation without duplicate firing.

Compare scenarios against official rules, not against existing engine output
alone. Complete the interpreter and scope/capture handling for these scenarios
before broad migration. Continue a card-by-card representability audit during
catalog conversion; unsupported instructions must be reported explicitly.
# Turn model readiness

Turn now contains only an ordered input stream. Generator execution, counters
and event history belong to the engine. Serialized frames and continuations
have been removed. One registry of RegisteredRule entries replaces the three rule registries, and
trigger/replacement answers use stable occurrence slots rather than menu positions.

The concrete event vocabulary is checked against EventPattern by a TypeScript test.
Request tests cover decision kinds, permutations, subsets, physical copies,
filtered modes, repeated triggers and collective payments. Generator tests verify
retrying invalid payment and target answers without changing the paused state,
reconstructing a paused prefix, preserving dependent healing results, abandonment
and public-value isolation. Recorded action tests preserve nondefault ink choices.

These checks establish the execution boundary, not correctness for every card
interaction. The engine implements turn lifecycle, rule registration, event
dispatch, replacements and full-game playback using immutable, structurally
shared positions. Independent resolutions, prefix reconstruction, stale-commit
rejection and result scope behavior have executable coverage. See
[the engine guide](../engine/README.md) and [the test guide](../tests/README.md).
