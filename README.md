# Simulator for Lorcana

A Lorcana game engine and deck simulator. Compare decks against reference lists using bots, either from the command line or in a web app.

[Try it!](https://dice2cu.github.io/simulator-for-lorcana/)

This repository is mostly AI generated code.  It probably won't receive a lot of ongoing support, and it probably has bugs and problems with the engine.
But if you want some kind of simulator to test out your deck ideas or a base to start your own AI generated simulator, then maybe you'll find this useful?

## Getting started

Use Node.js 24 or newer. From the repository root:

```sh
npm ci
npm run simulate -- --help
```

Deck files are plain text, with one quantity and full card name per line:

```text
4 Merlin - Goat
4 Madam Mim - Fox
```

Put your complete `.deck` lists in a local `decks/` folder, then run `npm run simulate`. Reference lists live in `reference-decks/`. Results depend on bot and engine behavior, so treat them as estimates, not tournament predictions.

## Development

```sh
npm test
npm run typecheck
npm run build
```

`src/model/` defines cards, abilities, game state and turns. `src/engine/` runs games, and `src/bot/` and `src/search/` make decisions. Card data is embedded in the build. Run `npm run update:cards` to download and regenerate it.

## License

The project code is available under either the [MIT License](LICENSE) or the [Unlicense](UNLICENSE), at your choice. Third-party dependencies and Lorcana card content retain their own licenses and rights.
