# Ability parser

Reads printed card text straight into the [ability model](../model/ability.ts).
There is no intermediate tree: each grammar rule returns model values, and every
printed slot must be consumed completely or the card is reported as unsupported.

```ts
import { parseCard } from '../index';

const result = parseCard(catalogCard);
if (result.supported) console.log(result.rules);
else console.log(result.issues); // each issue marks where recognition stopped: "... ⟪rest⟫"
```

`parseCatalog` parses a whole catalog and groups unsupported wordings.
`npm run parse:cards` runs it over the downloaded catalog.

## Files

| File | Contents |
| --- | --- |
| `text.ts` | Normalization (reminder text, symbols, contractions) and the `Cursor` that matches text. |
| `core.ts` | Parse state, scope steps and how they fold into nested effects, and final clean-up. |
| `nouns.ts` | Card and player noun phrases: determiners, filters, zones and pronouns. |
| `conditions.ts` | "if" and "while" conditions. |
| `effects.ts` | Sentences, clauses and verbs. |
| `abilities.ts` | Triggers, activated costs, static and replacement abilities. |
| `index.ts` | Keywords, play rules, deck rules, `parseCard` and `parseCatalog`. |

## How it works

- **Cursor.** Matching is case-insensitive and sticky. `c.try(...)` restores the
  position and parse state when an alternative fails, and the furthest position
  reached is reported when a slot cannot be parsed.
- **Steps.** A clause produces a list of steps. An effect step is a plain model
  effect. A scope step (choose cards, choose a player, for each card or player,
  search, random cards) wraps everything after it. `fold` builds the nesting and
  resolves placeholders to `Selected Cards` or `Parent Selected Cards`.
- **References.** The parse state remembers what "it", "they", "that character",
  "the moved character" and similar phrases currently mean. Triggers bind them to
  the event.
- **Validation.** Every result is checked with `validateCardRules` before it is
  returned, so a parse never yields a definition that refers to choices or events
  that are unavailable.

Ink totals such as Capsize's "6 ⬡ or less" count all inkwell cards, not just ready
cards. Each card represents one ink under comprehensive rule 5.2.3. Consecutive
conditions read the position when their own instruction runs, so Capsize can
resolve both instructions after adding ink.
