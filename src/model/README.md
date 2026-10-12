# Model

These definitions are the simulator's card, rule, position and turn formats. The
engine in `src/engine` implements the execution behavior described below; these
files hold only types, examples and the definition scope checker. Gameplay
verification belongs to the engine's tests.

The coverage target is real Lorcana card instructions, not every feature declared
by TCG. TCG is a comparison reference, not the specification. Do not add unused
mechanics just to mirror its types. No once-per-game instruction was found in the
local catalogs; a catalog regression check flags that wording if it appears later.

- `game-state.ts`: mutable facts and resolved lasting modifiers.
- `card.ts`: immutable printed card definitions, starting with the Card union.
- `identity.ts`: dependency-free physical card identifiers, player seats, and classifications.
- `ability.ts`: card rules, abilities and effects, including costs, keywords, event patterns, selectors, conditions, instructions, and continuous rules.
- `examples.ts`: type-checked examples, including Kida, Atlantis, and nested choices.
- `turn.ts`: player actions, ordered input steps, engine requests, answers, payments and concrete events.
- `game-state-view.ts` and `turn-view.ts`: visibility-filtered positions and turn history.
- `player-interaction.ts`: the shared human/bot controller, setup and deck composition, player-safe requests, answers and notifications.
- `strategy.ts`: strategic priorities and relationships, independent of controller implementation.
- `bot.ts`: the bot controller and its setup, derived knowledge and opponent beliefs.
- `turn-examples.ts`: an illustrative position, accepted prefix and healing request.
- `validate.ts`: binding scopes and event/result references in typed card definitions.

Each model file starts with its main type, followed by related supporting types.
Shared composition types live with their domain rather than with one consumer.
The import direction runs from bot/controller models toward turns, positions and
card rules. Core game models do not depend on bots or player controllers. Ability
and effect definitions stay together because they reference each other.

## Position versus execution

GameState describes the board during a turn and between turns. At a between-turn
boundary it identifies the upcoming turn, before beginning-of-turn processing.

Turn contains only accepted actions, answers and random outcomes. An unfinished
turn is a prefix of the same record. Reapplying it to its starting position
reconstructs the outstanding request. The current position alone is not a
complete suspended computation.

The engine owns the live generator, event history, counters and trigger bag.
These are not serialized turn properties. Instruction-local selections, results,
iteration and challenge progress are retained by ordinary generator control flow.
Lasting modifiers and delayed instructions that outlive the turn belong in GameState.

For characters, items and locations, CardRules.abilities[i] corresponds to catalog
abilities[i]. The parser keeps exactly one entry per printed ability, in order.
Deck-copy limits are Deck Construction entries that gameplay ignores and deck
validators can use. Multiple instructions stay in one ability. Actions use effect
and playRules. Sing and Sing Together are action-only play rules.
Printed text stays with the catalog, not in parsed rule definitions.

### Rule occurrences

The engine has one append-only rule registry: the evaluator's list of
RegisteredRule entries (engine/rules.ts) with their active status, uses and
occurrences. Printed, granted and created origins share it. A source departing or losing a grant retires its occurrence.
Re-entry and reacquisition append fresh entries. Queued triggers retain old slots
and counters. Suppression must not reset them. Never merge identical grants by
definition equality or object identity.

Trigger answers identify a registry slot and event-history index. Replacement
answers identify a registry slot. These are not indexes into a displayed menu.
Granted Activate, Boost and Shift actions use rule to select their occurrence.
Printed action references still identify fixed catalog ability slots.

Uses counts completed limited uses. Occurrences counts matching events. A
once-per-turn trigger checks its use limit when it resolves, unlike a restriction
to the first matching occurrence. Keep the correct occurrence even after its
source leaves play.

### Decisions and payments

Decision is a concrete request, and DecisionAnswer is the accepted reply.
One request is outstanding at a time, so no request ID is needed. Modes use their
original instruction indexes even when some modes are unavailable. Requests can
show rule sources and effects while answers retain only occurrence references.

Decisions can belong to one player or a nonempty together group, which submits
one answer. Ordinary group selections require Choose Player or iteration unless
the instruction explicitly asks for a collective decision.

Pay Cost records the complete plan, including each payer, physical ink cards,
spent ink drops, lore and ordered destinations. Validate both request constraints
and board-dependent payability before resuming. Candidate lists alone cannot
express every set-wide constraint. Invalid input leaves the live resolver and
accepted prefix unchanged.

### Event-time information

RecordedEvent is internal engine history containing the actual event and shared
before/after GameState references. This allows historical queries to use the
actual event-time facts even after cards move again. Departure queries and
atEvent: Before use the retained before position. Entry matching uses the
committed position. Simultaneous changes share one before position. Later
ordinary effect queries use the current board. These snapshots are not stored
in the persistent GameState or Turn models.

Snapshots must be immutable. Structural sharing can retain earlier positions
without deep-cloning every event. Retain the complete minimal position initially,
because event-time conditions can inspect other cards and players. The engine
uses structurally shared positions for updates and event dispatch.

The Rapunzel example is an abbreviated bookkeeping illustration, not a complete
legal setup or executable proof. Requests and selected targets are not board fields.

### Deterministic turn contract

A completed turn starts from a between-turn position, runs beginning-of-turn work,
and consumes actions, decisions and randomness at their corresponding boundaries.
Shuffle outcomes are full permutations. Random selections have the requested
count and no duplicate or ineligible physical cards. Ordered answers retain order.

End Turn initiates end processing rather than immediately completing the record.
A complete application must reach the turn boundary or game end and consume all
inputs. A prefix reconstruction deliberately stops at the next input boundary.
Use the same card definitions and rules. Do not apply a prefix to its already
updated position.

Register initial rule occurrences in ascending player order. Within each player,
traverse Deck, Hand, Play, Discard and Inkwell in stored order, with under cards
immediately after their top card. Traverse printed abilities and modifiers in
stored order. Continuous grants follow provider order, then recipient order.
Subsequent registration follows executed operations. Never compact slots.

The engine implements full turn processing, request validation, rule registration
and event dispatch. See [the engine guide](../engine/README.md) for its public API.

### Resolution order

1. Validate an intention and all required payments. For payments with choices,
   suspend to collect them; reject an invalid plan before committing it. Commit
   payment steps in their prescribed order, recording actual events and results.
2. Resolve the action/ability's instructions in order. Decisions suspend the
   current instruction. Nested instructions return their documented outputs
   to their caller and never drain the bag. Capture operands are evaluated in
   the creating scope before a lasting modifier is installed.
3. Complete the enclosing effect, finalize its action card's destination,
   and run its deferred generated effects. Apply game-state checks at the rules'
   specified boundaries, not arbitrarily after each Sequence instruction.
4. Drain the bag when the current resolution permits it. The engine retains the
   currently resolving player, who chooses among their pending triggers
   until none remain, then the bag passes in turn order. New triggers from another
   player do not interrupt the current player's resolution.
5. A challenge has a declaration boundary before damage. After its declaration
   bag clears, calculate both sides' damage, process applicable replacements, and
   commit damage simultaneously. After damage checks and triggers finish, remove
   challenge-only rules and emit After Challenge. A participant leaving early
   skips damage but still finishes the remaining bag and challenge cleanup.

Replacement processing is part of the proposed operation, before it is committed.
Self-replacements take precedence; the affected player chooses applicable
alternatives. Track applied definitions so the same replacement cannot apply again
to that operation, and handle identical instances together under the rules.
Replacement instructions use their own acting player/source context, not the
player who proposed the replaced operation. Only the operation that actually
happens enters event history. Challenge damage remains staged until every affected
assignment is ready, so a replacement decision cannot expose half-applied combat.

These boundaries follow the [Comprehensive Rules v2.2.0](https://files.disneylorcana.com/Comprehensive-Rules_2.2.0-EN.pdf),
particularly 4.6, 6.1.13.2, 6.5, 6.7, 7.4.3, and 7.7.

### Lasting modifiers

The existing modifier variants cover the examined persistent effects; no additional
historical-card properties are needed in GameState. Installation must enforce:

- Evaluate captures belonging to this installation against the creating scope,
  converting them to concrete cards, players, or numbers. Keep dynamic selectors
  dynamic. A Create Rule nested in a future granted ability keeps its own captures
  until that future instruction executes; do not bind them prematurely.
- Reject free references to Selected Cards, Selected Player, Named Card, or prior
  instruction results. Such references remain legal inside a stored ability's
  own future choice/sequence where that ability establishes them.
- Event references in a stored trigger/replacement refer to its future matching
  event. References to the creating event require explicit capture.
- Retain the creating source on created rules, replacements and triggers. Its
  player supplies You and its card supplies Self, regardless of the modifier's host.
  Ordinary numeric changes do not retain a source.
- On zone exit, clear card-bound modifiers and invalidate captured play targets;
  replaying the same physical card must not revive an old modifier.

This is scoped semantic validation at installation, not a reason to duplicate the
entire effect schema. A blanket ban on results/capture anywhere in a stored
definition would incorrectly reject valid instructions that establish their own
future local scope. TypeScript alone cannot enforce that distinction.

## Meaning

Fixed string values use Title Case with spaces: `"Deal Damage"`, `"Character"`,
`"Can't Be Challenged"`, and `"Sing Together"`. Property names remain camelCase.
Context references also use fixed string unions. There are no user-defined
binding names or `as` properties. Printed card names remain ordinary strings.
Sing Together is a song play rule, not a character keyword ability or a grantable
numeric keyword. It remains in Keyword so filters can identify songs that have it.

Ink filters match membership. An Amber-Steel card matches either Amber or Steel.
Distinct Ink Type counts the union of inks, not color-pair labels. An Amber-Steel
character and an Amber character contribute two types, not three. Adding a Ruby
character makes three. This also applies to Winnie the Pooh & Piglet's MAGICAL MIX.

All per-turn limits use `{ perTurn, count }`. Uses counts committed activations,
actions or resolutions. Occurrences counts matching events, including declined
optional effects. A replacement's occurrence limit applies to the first N matching
events, not N events chosen later. Independently created replacements use the same
limit vocabulary. Created rules' lifetime uses budgets do not reset each turn.

Classification lists the 45 known values from the catalog snapshot and ends with
`| string` to accept future classifications. This documents the vocabulary but
does not reject typos; TypeScript simplifies a union containing string to string.

Catalog definitions contain relative players, selectors, computed amounts, and
durations. Resolution turns them into concrete card references, numeric changes,
and expirations in the state. Definitions do not contain game-specific identities.

Actions are cards, not a kind of ability. Their rules have an `effect` directly.
Characters, items, and locations have an `abilities` array (empty for a card with
none). Both action cards and abilities reuse the same Effect model. `playRules`
explicitly describes singing, Sing Together, alternative payments, and play
requirements on any card. Nothing requires interpreting printed text at runtime.
An empty alternative cost means free; it does not ignore play requirements.
Normal printed ink cost remains part of the separate immutable catalog.
CardRules only describes this rules portion. The embedded [card model](card.ts) adds
the printed properties and stores these rules on each card. Examples separate
actionCardExamples from abilityExamples.

`Modify Cards` instructions select affected cards and compute changes once when
they resolve. Static `Modify Cards` rules continually reevaluate them. Create Rule
installs an independent live rule, so Atlantis also protects future characters.
Modify Players freezes the affected players. A created Modify Players rule instead
reevaluates its player selector while active.

Costs must be payable in full. Instructions follow the game's do-as-much-as-possible
rules. Choosing cards, choosing a mode, and accepting an optional instruction are
distinct operations. A selector alone never requests a choice. Missing a legal
choice does not cancel unrelated later instructions.

## Selections and results

`Choose Cards` and `For Each Card` supply `"Selected Cards"` inside their nested
instruction (a one-card set for each iteration). `Choose Player` and
`For Each Player` similarly supply `"Selected Player"`, a single player number.
These references are separate: choosing cards does not replace the selected player.
A nested choice temporarily replaces the selection of the same kind and restores
it on exit. `"Parent Selected Cards"` refers to the immediately enclosing card
selection, skipping non-card-selection instructions. In a Choose Cards `from`
expression, Selected Cards still refers to the outer selection; its own selection
is supplied only after choosing. Its optional `where` validates the prospective
whole set, allowing total-strength budgets and different-name requirements.
Random Cards samples without replacement and supplies Selected Cards, but does
not count as choosing targets. Search similarly supplies a selection without
inventing a chosen-target instruction, and follows the rules for searching hidden
zones. Selections do not escape their enclosing choice or iteration. Cost
choices use the same rule inside their nested `cost` array.

Instructions publish fixed outputs automatically:

| Instruction | Reference | Value |
| --- | --- | --- |
| Look / Reveal | `Looked At Cards` / `Revealed Cards` | Ordered physical card references |
| Discard / Banish | `Discarded Cards` / `Banished Cards` | Cards actually affected |
| Move Card / Move To Location | `Moved Cards` | Cards actually moved |
| Remove / Move Damage | `Damage Removed` / `Damage Moved` | Actual total amount |
| Lose Lore | `Lore Lost` | Actual total amount |
| Remove Damage | `Characters With Damage Removed` | Characters from which positive damage was actually removed |
| Ready | `Readied Cards` | Every card in play the instruction applied to, including any already ready ("Ready your other exerted Princess characters. They can't quest", Moana - Of Motunui) |
| Pay Cost | `Paid Cards` | Cards paid by card costs, excluding ink resources and exerting the ability source. Transient pre-payment facts remain available to resolution |

Only results that printed cards read are published. Other instructions, such as
Draw, Play and Deal Damage, publish nothing; add an output here when a card needs one.

Choice, random sampling, and search instructions publish their nested body's
results to their caller, without publishing the Selected Cards binding. For Each
and Repeat collect each iteration's local outputs: card outputs concatenate in
resolution order (set consumers deduplicate physical identity), numeric outputs
sum. Results inherited but not produced in an iteration are not collected. Empty
iteration groups overwrite produced-result aliases with empty/zero values.
This allows Colors of the Wind and the Headless Horseman to use results across
players without arbitrary result names. Repeat-until tests that iteration's
outputs before discarding its local context; an exhausted deck therefore stops
Sisu's reveal loop. A nested Sequence remains local except its final outputs
returned to the containing control instruction; no unrelated outer aliases leak.

Card results use `{ result: "Looked At Cards" }`. Numeric results use
`{ result: "Damage Removed" }`. A card-result count uses the existing count
expression, e.g. `{ count: { result: "Discarded Cards" } }`. `Name Card` supplies
the fixed Named Card reference consumed by `where: { namedCard: "Named Card" }`.
That matches a printed card name, excluding version/subtitle and including the
individual names of team cards. For example, naming Flotsam matches Flotsam &
Jetsam; naming Flotsam & Jetsam does not match a card named only Flotsam.
sameNameAs compares character names regardless of version. Neither compares
physical card identity. These names come from the immutable catalog, not a full
display name or a physical card identifier. See rules 5.2.6.1-5.2.6.3.

Results are available to later instructions in the same sequence and their nested
instructions. Each alias refers to the most recent instruction producing that
output in the current scope; even a zero/empty result replaces an earlier one.
Named Card is local to its enclosing sequence: naming inside a nested sequence
does not supply that binding to instructions outside it.
Nested sequences inherit outer results; ordinary nesting does not overwrite them
on exit. Control instructions explicitly publish their body's outputs as above.
Optional offers its entire nested instruction and publishes its actual outputs.
Declining publishes empty card results and zero numeric results for outputs its body
would produce, replacing older values. Local selections still do not escape.
Baymax - Armored Companion can therefore optionally heal, then gain lore for the
damage actually removed, without making the lore gain a separate optional choice.
There is no generic performed-result alias. Do Then represents non-ink sequential
instructions ("A to B" or "A. If you do, B"): resolve do, and run then only if do
was completely performed. Otherwise, run otherwise if supplied. This is an
instruction completion outcome, retained by the resolver for dependent instructions.
it is not game state. Partial changes remain; there is no rollback. An entire-hand
discard succeeds with an empty hand, but choosing and discarding one card does not.
Declining an Optional prerequisite or failing an exact choice does not count as
complete performance. Sequence completion requires all its instructions to complete.
Do Then publishes actual prerequisite results for both branches; selections inside
do return to their outer scope before either branch runs.

Pay Cost is for actual payments, including ink-containing sequential payments under
rule 6.1.5. These must be payable in full before committing. Its then sees Paid Cards;
otherwise sees an empty Paid Cards result and cannot read outputs from then.
Payment card selections remain local. Wrap Pay Cost in Optional for "you may pay".
Use Optional around a non-ink Do Then for "you may". Ordinary partial resolving
effects still do as much as possible.
Triggered abilities resolve in separate contexts and never overwrite these results.

These rules define which reference a parser emits, without inventing labels.
TypeScript rejects unknown aliases and card/numeric mismatches, but a semantic
checker must still reject references used without a corresponding choice or
earlier instruction. Fixed references intentionally cannot address two independent
outer card selections beyond the immediate parent or two older results of the same kind. If actual cards need
that, add a narrowly defined construct rather than arbitrary variable names.

Event references initially refer to the triggering event. Creating a rule,
replacement, or delayed instruction uses explicit `{ capture: ... }` operands for
outer choices, event operands, or computed numbers. A rule's own event references
refer to its future matching event, not the event that created it. Capture
operands become concrete `{ cards: [...] }`, `{ players: [...] }`, or numbers
before being stored; no capture instruction or vanished local binding is left in
state. Event facts needed after
a card leaves play must be provided by runtime resolution, not reconstructed
from the current board. Captured physical references must not reconnect an old
effect to a card that leaves play and returns.

For a lasting play target, lower a capture to the existing concrete selector
`{ zone: "Play", cards: [...] }`, and prune that binding on departure. Replaying
the same physical card does not put it back into an old binding. Other zone-bound
captures preserve their own zone. This is a transition responsibility, not an
additional incarnation counter or copied card-facts object.

Selectors read effective characteristics. Zone Any is a query wildcard, not a new
game zone: it permits a next-play discount to apply outside the hand as well.
`printed: true` explicitly reads a
printed numeric characteristic. `stat` and `lore` expressions require exactly one
card/player. `sum` explicitly aggregates characteristics (empty sum is zero).
An absent characteristic is not silently invented as zero. `{ every, where }`
requires a nonempty set whose cards all match. To test whether any match, use
`{ exists: { filter: ..., where: ... } }`. Opponents is a set, not an assumed
second player. Conditions and numeric filters use the same Comparison type:
`{ value: { count: ... }, is: { atLeast: 2 } }` and `{ strength: { atLeast: 2 } }`.

## Timing and rule proposals

### Choices, locations and Shift bases

Chosen records a character/card chosen for an action or ability, with the choosing
player, source card when one exists, and Ability/Action kind. It is not emitted
for random sampling, searches, payment selections or Shift-base selection. Support
keeps its separate Chosen For Support event. Simultaneously chosen targets share
the event-time snapshots; choice triggers wait for the appropriate bag boundary.
Flynn Rider - High-Climbing Rogue uses this event's Player to make the opponent
choose and discard, rather than confusing them with the chosen card's owner.

`{ locationOf: ... }` returns the current locations of selected characters,
deduplicated by physical identity. Characters without a location contribute
nothing. It never prompts for a choice. A scalar stat query still requires exactly
one location. I’ve Got a Dream selects a character at a location and reads that
location's lore through this operand; filtering with at handles the reverse relation.

Play events for Shift and Shift events retain onto: the directly selected base
cards, not the entire resulting under-stack. An EventPattern's onto matches when at least
one actual base belongs to its selection. Sources on those bases are observed
from the pre-Shift position, even though the bases are covered afterward. Meilin's
trigger grants Evasive to the incoming event Card, not to the covered base.

Can Shift Onto permits its matching incoming cards to use matching bases despite
printed base eligibility, including name/classification requirements of Shift
variants. It does not grant Shift to a card without it, waive costs, change the
number of bases, or remove unrelated play requirements. Set-wide named-base
requirements must recognize permitted substitutions when checking each required
base; they cannot be implemented as an unconditional after-the-fact name comparison.
Morph's example uses this permission, without inventing names for Morph.

Shift names supplies individual required-name slots: with count 2 and two names,
find a one-to-one assignment of the two distinct physical bases to those slots.
A Morph substitution can satisfy a name slot, but one card cannot fill both.
onto filters per-base eligibility; when is reserved for independent whole-set or
board requirements, which Can Shift Onto cannot waive. An allowed one-or-two-base
Shift uses onto plus count, not a two-name mandatory assignment. This separates
eligibility from payment, cardinality and independent requirements in the data.

Modify Cost with for: Shift can additionally constrain onto. Evaluate it against
the proposed actual bases; apply each active rule instance once if any base matches.
Belle therefore discounts shifting onto her, not every Shift while she is in play.
Multiple independently applicable instances follow normal cost-modification rules.
For movement, Modify Cost and Alternate Cost can constrain location. The Sorcerer's
Tower grants free movement to that exact location, not to any location while it
is in play. Normal play costs cannot contain a destination-location property.

skipDrawStep belongs to player changes/modifiers. Arthur supplies it through a
static rule. It skips the normal Draw step, never a Draw instruction from a card.

State modifiers have optional `starts` and `expires`, explicitly on each variant.
Absent starts means active immediately. `duringNextTurn` resolves to the start and
end of the specified player's next turn after the current turn; activation removes
starts, while expiration removes the modifier. A source-dependent static rule is
still derived from the source in play, not copied into state.

Created rules, replacements and triggers are optional card/player modifiers,
not top-level objects with IDs. A specific target's rule can stay on that card;
a player-wide rule stays on its acting player. They reuse the catalog instruction
types but have resolved captures. Their host is not necessarily their creator,
so attribution and relative references come from the retained source, not from
the protected card's owner or the player whose modifiers contain the rule.
Created modifiers store source as `{ card, player, kind }`, where kind is Ability
or Action. This is a physical card reference, not a copy of its printed facts or
an arbitrary effect identifier. Source does not keep an effect active by itself.
Leaving play ends the effect only if its duration says so.

Source supplies Self and You when a created rule is evaluated. Explicit captures
still freeze chosen cards, prior results and references to the creating event.
Queued instructions and resolver scopes retain the same source context. Their
player field identifies the current actor rather than overwriting attribution.
Gained abilities are different: they belong to the receiving card and resolve
as that card's abilities, not as instructions from the card that granted them.

`uses` is the remaining uses, not a generated identifier. Zero-use modifiers are
removed. A next-play cost rule consumes a use when an applicable play commits,
including one costing zero ink; merely evaluating cost does not consume it.
Enter Play rules apply before the Play event and consume once for the actual
entry. Their granted modifier can have its own longer duration after the one-use
entry rule is gone. Static stat rules don't consume uses on every recomputation.
Both printed and created passive rules reject use limits because they have no
committed action or entry that could consume a use.

Delay lowers to a one-use Turn Start/Turn End trigger at the next specified
boundary. A future turn-start delay has starts set to that boundary. There is no
separate pending-resolution queue in the between-turn state. Static, triggered and activated
abilities can declare their active areas with from (e.g. Lilo in Discard).
Their ordinary default is play, plus relevant self-entry/self-exit handling.
Per-turn limits reset outside the snapshot: uses versus occurrences distinguishes
"once during your turn" from "the first time each turn".

Granted abilities belong in CardModifier, because gaining an ability is changed
state. Source-derived grants are still computed from the board, not redundantly
stored. AbilityReference indexes only immutable printed abilities. Granted activated
abilities select an active granted-rule registry entry rather than copying instructions.
Named suppression matches actual catalog ability names, not invented labels.

Player modifiers mirror player changes: scoped play/ink permissions, restrictions
on matched card types, additional ink,
start-of-turn readying limits, and a changed victory-lore threshold. The latter
changes the rule used to derive victory; it does not store a result flag.

Conditional restrictions evaluate Affected Card against the current position.
Their by/byPlayer limit the interacting attacker or choosing source/player, not
every opponent indiscriminately. Name supplements and Shift-only names are rules
over catalog identity; printed names are not copied into CardState. Minimum-stat
rules are applied after modifiers, not implemented by changing printed stats.
Active ability/keyword suppression masks matching printed and gained instances;
it does not delete their definitions. When suppression ends, otherwise-active
grants return. Granted abilities retain separate usage counters. Prohibitions
override permissions; array position does not decide that conflict.

Rapunzel's protection is a `preventDamage: "Next"` modifier on the affected card.
It is independent of her remaining in play and is not a granted ability. At the
next applicable Deal Damage event it prevents damage and is consumed; otherwise it
expires at her player's next turn start. Multiple instances of this same
replacement that apply to the event cease together under the game's replacement
rules, rather than creating several shields against successive events. Zone exit
clears the modifier so returning the same physical card does not restore it.
Putting/moving damage is not dealing damage and does not consume this prevention.
Captured Play-area target lists are pruned when those cards leave that area, even
if the rule is on a player; a returning physical card cannot revive an old target.
Unzoned concrete references may still identify a physical card for an intended
cross-zone operation. Printed characteristics remain available through its id;
transient old event/payment characteristics are resolved before persistence.

Event patterns now distinguish banishment causes and challenge participants,
singing, cards put into the inkwell, and zone movement. Play event conditions may
read Ink Paid, which is actual ink paid after modifiers/alternate payments, not
printed cost. `anyOf` matches alternative trigger clauses without triggering twice
for the same underlying event. A Sing pattern normally matches each singer;
together: true matches once for the song with the matching group in Singers.
The evaluator must preserve the facts at event time when cards move afterward.

`countEvents` queries transient resolution history from This Turn. Zone movement
counts physical cards (including cards under a banished card), not just the number
of top-level instructions. This history is not added to GameState: it is empty at
the next turn boundary. Damage removal conditions can match Remove Damage events
with an Amount condition; moving damage also generates removal/putting events.

Additional Cost applies before questing/challenging. Declining the extra payment
means that action is unavailable, not that a post-action trigger failed. Alternate
Cost replaces the base payment; other applicable requirements still apply. An
action's alternateCost selects either its own playRule index or a source ability.
Challenge Damage chooses the characteristic used for challenge calculation, not
a Deal Damage trigger afterward. Play with method: Shift requires the selected
card's Shift definition and legal underlying characters; free waives its payment,
not these requirements.

Play only performs play. Optional offers the choice to play, and Do Then supplies
success/failure branches. For a consequence that also applies when play is declined,
put Optional inside Do Then's do, not around the whole Do Then. Declining leaves
the play unperformed and runs otherwise. If another player chooses whether to play,
specify that player on both Optional and Play. Play's afterwards destination still
redirects an action after resolution (e.g. Ursula's replayed song). None of these
instructions bypass applicable costs or play requirements. Reveal Until publishes every
card examined through the first match or exhaustion. Remove Damage defaults to
the stated amount per card; distribution Total instead gives one shared amount
that the acting player allocates across the eligible cards. Ignore Resist belongs
to that damage instruction, not to a permanent target modifier.

Play's player field identifies who performs the play and pays its cost.
Omitted means the acting player. It does not change You in subsequent
instructions belonging to the original ability. Look similarly has an optional
private viewer, defaulting to the acting player. Reveal makes cards public for the
applicable resolution. Neither operation changes their zone. Look requires exactly
one viewer, even when its cards belong to multiple players.

CardRestriction and CardPermission apply to individual cards. PlayerRestriction
and PlayerPermission govern the player's actions or lore. For example, Can't Quest
belongs on a character, while Can Ink From Discard belongs on its player.
The same distinction applies to stored state modifiers.

Repeat specifies either times or until, never both. The latter checks its condition
after each iteration and stops when it becomes true or there is no more work to do.

Choose Mode describes printed modal choices. Or describes sequential alternatives
under rule 6.1.5.2: offer only alternatives that can be chosen, force the remaining
one if only one is available, and do nothing if neither can be chosen. Branch
eligibility is a rules query before execution, not a speculative mutation followed
by rollback, and is not equivalent to testing whether it changes the board.
Both use a Choose Mode decision containing the offered alternatives. If an
alternative publishes an output alias, the control instruction initializes that
alias to empty/zero when a different alternative produces none. This keeps later
references deterministic without making one alternative's results available inside
another. Optional publishes its own outputs, empty/zero if declined, without
publishing its local card/player selection.

### Authoring and validation

Direct Modify Cards instructions freeze their target list and compute numeric
changes immediately. Their restrictions retain predicates, and granted abilities
establish future instruction scopes: local references in those stored definitions
require capture. Modify Players retains permission selectors and character rules;
its modifier therefore has a fresh persistent scope. Those rules reevaluate live
board operands (including Affected Card inside character changes), but outer
selections, results and event references must be captured. Targets and durations
of both instructions are still evaluated in the creating scope.

Validation rejects negative literal costs, operation amounts, selection counts,
keyword values and usage limits, plus non-finite/fractional literals. Signed stat
changes and cost adjustments remain legal. Computed quantities must be checked by
the evaluator in their consuming domain; the validator does not prove arithmetic
bounds from the current board. Numeric fields are not all interchangeable.
Entry damage must also be nonnegative. End Of Challenge expiration is rejected
in known outside-challenge contexts (activated abilities, turn-boundary triggers
and delayed turn-boundary instructions). Other contexts may depend on invocation:
an action generated by an ability can resolve during a challenge. The evaluator
must require an active challenge when installing that expiration; unknown does
not mean that an expiration without a challenge is legal.

Free Ability represents permissions such as Maui's Fish Hook's IT'S MAUI TIME!.
It selects cards and optionally an actual printed activated ability name
(SHAPESHIFT in that example), or keyword: "Boost". These selectors cannot be
combined. Without either it applies to their activated/Boost abilities. This is an
alternative use permission: free on an Activate/Boost intention must be validated
against an applicable rule. The printed costs and ability indexes stay unchanged.
Using an ability for free still requires exerting its source when its cost includes
that exert symbol (rule 6.1.7.1); it waives the other costs. Conditions, drying,
per-turn limits and other activation requirements still apply. It does not grant
permission to perform a Shift without paying its play costs.

Use the following canonical forms when producing catalog definitions:

- Put zone-query constraints in the selector's where. Use filter only to narrow an
  existing selection/result. Do not wrap a zone query in an equivalent filter.
- Use gainKeyword for simple and numeric keyword grants. Use gainAbility with a
  complete KeywordAbility for Shift/Boost grants. GrantedAbility enforces this
  distinction and excludes deck-construction rules. Parameterless grants prohibit
  amount; numeric grants require it, including in resolved state modifiers.
- Use Sequence for ordinary successive instructions, Do Then for dependent
  non-ink instructions, Pay Cost for payments, Or for sequential alternatives,
  and Choose Mode for printed modal choices. Never infer completion from a result
  count when the operation has different success criteria.
- Use Move Card with a destination-specific shape. Deck movement requires Top,
  Bottom or Shuffle; Shuffle has no order. Under requires the destination card
  and faceDown. Inkwell cards are always facedown, so no faceDown flag is stored.

validateCardRules returns property paths and explanations for scope errors. It
checks selection depth, named-card bindings, available instruction results, event
fields (including the intersection of alternative triggers), explicit captures,
known scalar cardinality, choice counts, and under-zone selectors. Future granted
abilities get fresh local scopes; their nested installations can capture those
future scopes. Store the validation outcome when loading definitions, not per AI
candidate or per game. The checker uses unknown when traversing operand objects
and adds no Node dependencies.

It accepts typed CardRules. Parsing arbitrary JSON still requires structural
validation, and board-dependent cardinality/legality must be checked by execution.
No parser integration or evaluator is implemented by these model changes.

Zone-specific movement parameters, context references, and choice cardinalities
must be validated before execution. For resolving exact-count choices with too few
eligible cards, follow the game's partial-resolution rules; paying an exact-count
cost still requires the full count. Reject malformed model definitions separately
from a legal effect that cannot fully resolve in the current position.

The Water Has Memory example chooses a player, looks at up to four actual top
cards, chooses one for the top, and orders the remaining cards on the bottom.
The look result captures those physical cards; it is not a live top-four query.
`difference` removes the chosen card from that captured set. Moving cards to a
deck respects their owner's deck. Chosen ordering is top-first within the moved
group, including the group appended at the bottom; the acting player orders it.

Engine rules remain responsible for legal choices, event timing, the bag,
replacement ordering, and simultaneous results. The model does not redefine them.

## Limits

The engine executes every instruction the embedded catalog uses. Combinations the
format allows but no card uses, and cooperative Quest-only mechanics, may still
be unsupported. Definitions
from untrusted JSON are not structurally validated: the scope checker cannot prove
dynamic cardinality or board-dependent legality.

No parser, evaluator, generic query language, or Node dependency is added here.

## Additional TCG comparison capabilities

See [TCG-COMPARISON.md](TCG-COMPARISON.md) for the capability comparison and its
scope. The focused model checks now also exercise:

- Draw from Bottom: still a draw, so it produces draw events/results rather than
  being approximated by moving a card to the hand.
- Stat modifiers combine without timestamp or array ordering. getModifiedStat
  starts with the printed value, adds all signed deltas, then applies the
  strongest minimumStat floor. Negative Strength/Lore reads as zero, but
  intermediate negative values are not clamped while combining. Callers supply
  already-active, resolved modifiers, including live static rules.
  See [Comprehensive Rules 6.6](https://files.disneylorcana.com/Comprehensive-Rules_2.2.0-EN.pdf).
- Reveal Cards: continuous public visibility. Roz does not repeatedly execute
  Reveal instructions when the top card changes.
- challengeLimit with count Characters and explicit players: a shared
  distinct-challenger budget, so readying a challenger does not add a character.
- events selections: cards from matching turn events, with an explicit role such
  as Singers or Attacker. Repeated participants deduplicate by physical identity.
- highest/lowest group statistics: unlike sum, an empty group has no value.
- atEvent Before: read an amount, card selection or condition against the retained event position,
  including an under-stack before its character is banished. Unavailable outside
  an event context. This is separate from printed characteristic reads.
- Play Or Shift: an explicit play choice. Free play waives only the payment;
  other requirements remain.
- End Of Challenge: lasts until the current challenge finishes, not until the
  turn ends. Only meaningful while resolving a challenge.
- Omitted lasting-effect duration: no time boundary; ordinary zone-exit cleanup
  still applies to card modifiers. Player rules remain until removed or consumed.
- Replacement damage: adjust a proposed amount while preserving its
  original source and kind. Replacing it with a fresh Deal Damage instruction
  would misattribute damage and subsequent triggers. Apply prevention/Resist to
  the final recipient without counting either twice.
- Deck selectors can take a Top/Bottom slice, preserving deck order. This
  supports private bottom-deck looks without pretending to draw.
- Put Under records both the moved card and its destination. Chosen For Support
  records its recipient and supporting source. Sing events record the singers.
- challengeParticipant reads the live attacker/defender in continuous rules,
  independently of retained triggering-event participants.
- Modify Cost for Play includes normal play and Shift. For Shift can constrain its bases. Next-play discounts are consumed once
  by a committed play, not separately for its Shift method or price queries.
- Shift and Boost intentions select a printed slot or a turn-local granted rule.
  Copied keyword values cannot identify identical grants with separate budgets.
- Player selectors: from supplies the initial set, where binds Selected Player
  to each candidate, and rank evaluates its by amount for each surviving player.
  Highest keeps all ties in input order. That binding is local to the
  selector; it does not leak into the containing effect. For Each Player freezes
  the resulting participants before anyone discards, so the first discard cannot
  change who else was tied for largest hand.
- Group decisions: `{ together: players }` is one decider made up of several
  players, used where a single player would otherwise decide: the `player` of
  Choose Cards, Choose Player, Optional and other choices, and an activated
  ability's `by`. "The opposing players together choose" (Tamatoa - Grabby Crab,
  Fortunate Hit) and "they may together pay 3 lore" (Hercules - Manipulated Hero)
  use it. The group shares a cost unless the cost says `each`: Monumental Scarab's
  "pay 3 ⬡ each" makes every player in the group pay 3 ink. A group is never a
  single player for operands such as `lore`.
- Discard events record whether the discard paid a cost or was caused by an
  effect (`kind: "Cost" | "Effect"`). Kronk - Laid Back and Magica De Spell -
  Cruel Sorceress prevent only discards caused by effects.
- Optional limited static discounts: limit with count: "Uses" counts committed actions, not
  price queries. Optional Cost Rule is a separate decision from Optional Effect;
  declining or abandoning an action consumes no use. When the price would be
  unpayable without the discount, the engine applies it without asking, since
  declining is not a real choice there.
- Choose Cards decisions state every constraint the validator enforces: `required`
  lists cards a nonempty answer must include (John Smith - Undaunted Protector must
  be chosen if able), and `total` gives each offered card's value and the maximum
  sum (The Leviathan's total Strength). Players never need to read a condition.
  A choice made by an effect also carries that `effect` as printed, like an
  Optional does, so a player can tell a buff from removal. Choices made while
  paying a cost have none.
- Damage event patterns accept `player`, the player responsible: "whenever you
  remove 1 or more damage" ignores healing by an opponent (Grand Pabbie).
- Move Card patterns accept `batch: true` for "whenever you put 1 or more cards":
  cards moved together trigger once while that trigger waits in the bag
  (Mamá Coco - Visiting the Park). Passive stat rules cannot
  have this use limit. Raksha is modeled even if she enters play after Turn Start.

A Shift intention can explicitly select an alternate-cost source, just as Move
and Play do. A Deck Bottom cost can require chosen/random ordering; the resulting
CostPayment already contains the concrete cards in their final order.

The resolver retains replacement occurrences across all instructions in that
resolution (rules 6.5.2 and 6.5.5), not a fresh per-instruction ledger. A nested
played action has its own effect scope. Ordinary instruction scopes inherit it.
Redirection can change applicability; an already applied effect cannot reapply.
Under rule 6.5.8, multiple instances of the same replacement effect cannot apply
to the same event: choose one and remove the other instances. Applied and Duplicate
entries cannot be offered again. Determine equivalence after
binding context, rather than merging arbitrary source-relative definitions; Self
on two different cards is not the same recipient. Rapunzel's two protections of
the same character are the official duplicate example. These are resolution-local
records, not persistent effect IDs.
Additional verification findings and the adoption recommendation are recorded in
[VERIFICATION.md](VERIFICATION.md).

## Concrete coverage examples

These are representability examples, not an assertion of an exhaustive card audit.
They are checked against the local allCards.json snapshot and type-checked.

| Mechanic | Example |
| --- | --- |
| Lasting one-use protection / future activation | Rapunzel / John Silver |
| Created discount / one-use entry rule | Lantern / Powhatan's Staff |
| Granted ability / named suppression | Bruno / Angela |
| Ability active in discard / hand | Lilo / Anna |
| Two independent targets / three-card routing | Maleficent / The Family Scattered |
| Across-player results / ink-type counts | Headless Horseman / Colors of the Wind |
| Search / reveal until match / repeat until failure | Alma / Fred / Sisu |
| Total healing / heal-only-successful targets | I'm Never Not by Your Side / Goofy |
| Replacement instead of damage / first matching event | Beast / Lilo |
| Conditional attackers / stat floor / Shift name | Captain Amelia / Elisa / Turbo |
| Player readying limit / changed winning threshold | Marshmallow / Donald |
| Action replay and destination / Resist bypass | Ursula / Piercing Attack |
| Dependent shuffle / compulsory alternative / private hand look | Chernabog / Megara / Diablo |
| Named ability free-use permission, retaining source exertion | Maui's Fish Hook |
