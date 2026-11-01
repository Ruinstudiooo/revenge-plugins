# Ruin plugins

plugins for revenge classic (the normal revenge, not the next branch that got discontinued).

## install

add this as a plugin repository in revenge:

```
https://ruinstudiooo.github.io/revenge-plugins/
```

settings > plugins > add repository, paste that, then install whatever you want from the list.

## ghost ping

someone pings you, then deletes the message to pretend nothing happened. this puts a toast on screen
with who did it and what it said.

it listens on the flux bus:

- `MESSAGE_CREATE` keeps the last 200 messages in memory, because the delete event only carries an id
- `MESSAGE_DELETE` looks that id up and decides if it was aimed at me

things it skips by default: my own messages, bots, and deletes of anything older than 15 minutes so
cleaning out a channel doesn't rain toasts.

there's a settings page inside revenge with the master switch, an @everyone / @here toggle, the bot
filter, and how late still counts (5m / 15m / 1h / any).

## build

```sh
npm install
npm run build        # -> builds/ghost-ping/index.js
npm run dev          # rebuilds while you edit
```

classic revenge evals the bundle like this:

```js
(bunny, definePlugin) => { /* bundle */ return plugin?.default ?? plugin }
```

so the build is esbuild with `format: "iife"` and `globalName: "plugin"`, which leaves the export
sitting on a top level `plugin` variable exactly where the loader looks for it.

after building, bump the version in `builds/ghost-ping/manifest.json` **and** in `repo.json`. revenge
compares the two when it checks for updates and ignores anything that isn't higher.

## layout

```
repo.json                     what the plugin browser fetches first
builds/
  ghost-ping/
    manifest.json             id, version, entry point
    index.js                  the built bundle, committed on purpose
src/
  index.ts                    flux listener and the delete logic
  settings.ts                 settings page
  shared.ts                   settings shape, defaults, storage handle
build.mjs
```

`builds/` is what gets served, `src/` never is. github pages is pointed at the repo root, so both
live side by side.
