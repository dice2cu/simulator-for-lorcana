# Ability/effect model compared with TCG

Reviewed against the supplied local `tcg-engines/submodules/lorcana` workspace on
October 5, 2026. This compares declarative capabilities, not engine correctness,
performance, parser accuracy or the number of implemented cards.

## Design choice

Keep the small compositional model. A wholesale copy of TCG would introduce
overlapping representations and unspecified string/unknown escape hatches. The
comparison did justify concrete additions; these are now represented and checked
instead of being left to prose or card-specific opcodes.

| TCG capability | Our representation |
| --- | --- |
| Keyword, activated, triggered, static, replacement | Distinct Ability variants; actions store Effect directly |
| Parameterized/conditional keyword | Strict KeywordAbility parameters; Conditional rule grants a keyword |
| Source zones | Ability.from |
| Composite activation payments | Ordered Cost array; nested payment selections |
| Optional effect versus payment | Optional, Do Then and Pay Cost are separate |
| Once-per-turn / first occurrence | Uses versus Occurrences counters; independent grant entries |
| Optional limited static discounts | Static.limit with count Uses, optional cost rule, commit-time consumption |
| Draw / bottom draw / draw to hand size | Draw, from Bottom, computed nonnegative hand-size difference |
| Choose, random discard, mill | Choose Cards, Random Cards, Move Card from top-deck selection |
| Deal / put / remove / move damage | Distinct instructions; actual numeric and affected-card results |
| Aggregate healing | Remove Damage with distribution Total |
| Gain/lose lore | Numeric operations with explicit players |
| Banish / exert / ready | Operations over sets, with actual results |
| Select target / fixed target references | Scoped Selected Cards/Player and Parent Selected Cards |
| Return, ink, tuck, shuffle, cards under | Destination-specific Move Card variants |
| Normal play / free / Shift / either | Play payment fields, method and actual-play branches |
| Action destination after resolution | Play.afterwards and resolver-local deferred destinations |
| Move to location / same location / location lore | Move To Location, at and locationOf |
| Destination-specific movement cost | Modify Cost / Alternate Cost with location |
| Shift name, classification, item and multi-base variants | onto, count, names and independent when |
| Temporary Shift | afterShift installs a delayed top-card-only move |
| Shift substitutions / base discounts / Shift-on-source triggers | Can Shift Onto; cost onto; event onto |
| Additive, floor, challenge damage stat | stat, minimumStat and Challenge Damage |
| Grant/suppress ability or keyword | Complete gainAbility/gainKeyword; loseAbility/loseKeyword |
| Inkability / supplemental name/classification | Actual changes, not copied immutable card facts |
| Play restrictions / exceptions / additional payment | Restrictions, permissions, Additional Cost and PlayRule |
| Skip draw / ready cap / challenger cap / victory threshold | Explicit player changes with distinct meanings |
| Look, reveal, search, scry, reveal-until | Separate primitives plus scoped selections and sequencing |
| Continuous faceup top card | Reveal Cards rule, not repeated Reveal operations |
| Modal choice / mandatory alternative / conditional / sequence | Choose Mode, Or, Conditional and Sequence |
| Repeat / for-each player/card | Scoped loops with collected actual results |
| Replacements, prevention | Event-matched Replacement; damage changes preserve cause |
| Created triggers/replacements / delayed instructions | Created rules in modifiers; explicit capture and duration |
| Turn/next-turn/challenge/source-dependent duration | Duration lowered to starts/expires; permanent changes omit duration |
| Count, sum, min/max, differences, clamp, distinct colors | Compositional Amount expressions |
| Pre-banishment characteristic / under-stack | atEvent Before against retained event snapshots |
| This-turn metrics and participants | countEvents and events selectors over recorded events |
| Bottom-of-deck selection | CardSelector.position Bottom with take; no accidental draw event |
| Historical card selections | atEvent Before selects an earlier under-stack by physical identity |
| Support / under destination / song-play group | Explicit event source, under and Singers |
| Live challenge opponent | challengeParticipant, independently of triggering-event references |
| Play-method cost filters | Play covers both; for Shift can filter bases |
| State predicates and comparisons | exists, every, shared Comparison operands and AND/OR/NOT |
| Highest-hand players, including ties | Player selector with candidate-scoped amount ranking |

The comparison fixtures in `model-tcg-comparison.test.ts` check scoped definitions
and serialization. Real-card excerpts in `model-coverage.test.ts` separately check
the local catalog text. Neither is an execution test or a format converter.

`model-tcg-surface.test.ts` maps **105 of the 108 distinct named members** of the supplied
`Effect` and `StaticEffect` unions into **47 canonical fixture families**. A source
union inventory comparison found no missing or extra member names. SetStatEffect,
RedirectDamageEffect and CreateReplacementEffect are deliberately left out: no
Lorcana card uses them, so the model dropped setStat, redirect and Create Replacement. Aliases share
examples rather than generating redundant opcodes. This establishes a counterpart
for each family, not field-by-field equivalence for every permissive legacy object
or every card combination. These fixtures also exposed missing Moved Cards
publication for location movement, now fixed. Usage restrictions, expressions and
execution correctness are separate from this effect-family inventory.
The inventory is a manually audited snapshot, not an automatic comparison against
an external checkout. The test checks unique assignment, not a hardcoded count as
proof of completeness. Private Look and public Reveal now have separate inkwell
fixtures. Real-text examples additionally cover Stolen Scimitar, Snuggly Duckling
and Seven Dwarfs' Mine: their numeric "instead" instructions can use Conditional
without adding card-specific operations or a parallel self-replacement syntax.

The follow-up adds Baymax - Armored Companion's optional healing followed by lore:
Optional now publishes actual results, or empty/zero outputs if declined. Validation
also rejects known empty/group operands for movement destinations, moved-damage
endpoints and whileInPlay sources; dynamic operands still require runtime checks.
getModifiedStat tests additive combination, floors and nonnegative Strength/Lore
reads. Conflicting hypothetical setters are rejected, not assigned invented ordering.

Created rules, replacements and triggers now retain their originating card,
player and Ability/Action cause. Capturing an explicit operand alone was not enough
to preserve that attribution after serialization and source departure. Queued
instructions and resolver scopes carry the same context. Validation also rejects
known grouped single-player operands and use limits on passive created rules.
These close model gaps without changing authored card instructions or claiming
execution parity with TCG.

## Deliberate differences

- TCG's duplicate heal/remove-damage, return/movement and look/reveal aliases map
  to one canonical operation each. We do not need a distinct opcode for each
  wording or destination wrapper.
- Static rules cannot contain ordinary draw/play/search/optional operations.
  Permissions and triggered instructions express those behaviors explicitly.
- Arbitrary target labels and unspecified X/string expressions are not imported.
  A meaningful expression must have a defined operand and scope.
- `CountEffect` becomes an amount expression, not an instruction that secretly
  overwrites the triggering event's amount.
- TCG's engine-specific application keys, deferred lethal-check flags and automatic
  bag draining are execution policies, not card-rule vocabulary. Our model does
  not let authored cards opt out of required game timing.
- Nonprinted engine shortcut abilities (for example Monstro's added combo
  instruction) are not imported as card rules. Represent the printed abilities
  and let the AI/executor discover or optimize their legal sequence.
- Continuous grants and replacement occurrences are not identified by JS object
  identity. Printed slots remain immutable; turn-local grants and resolution-local
  candidates have independent bookkeeping even after JSON serialization.
  Gained Shift/Boost actions select registry occurrences rather than copied keyword
  definitions. Replacement application belongs to the whole-effect frame, not a
  per-instruction continuation that forgets earlier applications.
  Replacement application still follows rule 6.5.8: duplicate instances of the
  same effect cannot stack on one event; unselected duplicates cease to exist.
  Printed usage entries are also occurrence-based, so replay cannot overwrite a
  counter retained by an older pending trigger.

## What this does not establish

TCG also declares permissive legacy/future shapes, including once-per-game usage
restrictions and arbitrary strings for conditions, attributes and durations. No
once-per-game instruction was found in the local card catalog during this pass.
Our current limits are explicitly per-turn; do not claim support for a future
once-per-game card without designing its persistent usage semantics. Copying a
placeholder type would not implement that capability. A catalog-text test flags
once-per-game instructions after updates. Real card coverage is the goal; matching
unused future/legacy TCG shapes is not a requirement.

The catalogs are not identical snapshots. We have not translated every card in
either catalog. Cooperative Quest encounter instructions and every combination
of replacement/choice/expiry behavior have not been established by these tests.

The source scan found two useful counterexamples to merely copying TCG:
Raksha's optional once-per-turn movement discount is not fully described by its
structured effect, and Dale's non-ink sequential instruction is modeled there as
Pay Cost. Our definitions explicitly encode Raksha's limit and optional discount,
and distinguish Dale's Do Then instruction from an activated ability payment.
Its requested top-card count must be reflected in instruction completion: an
undersized deck is not silently treated as having supplied all three cards.

Consequently, this is evidence of broader and more precise coverage of the
audited concrete mechanics, not proof of superiority in every possible respect.
The proposed definitions still have no evaluator. The current engine's passing
tests cannot establish that these new definitions execute correctly.
