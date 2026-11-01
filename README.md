# Ruin plugins

plugins for revenge classic (the normal revenge, not the next branch that got discontinued).

## install

add this as a plugin repository in revenge:

```
https://ruinstudiooo.github.io/revenge-plugins/
```

settings > plugins > add repository, paste that, then install whatever you want from the list.

## platform spoofer

makes your phone report itself as the desktop app, so everyone sees the desktop icon instead of the
phone one, including people on stock discord.

the gateway tells discord which platform a session is the moment it connects, in the identify frame:

```json
{ "op": 2, "d": { "token": "...", "properties": { "$browser": "Discord Android", "$device": "Pixel 7" } } }
```

`$browser` and `$device` are what the server reads. the plugin hooks `WebSocket.prototype.send`,
catches that one frame, swaps the properties for a desktop set, and lets everything else through
untouched. token, presence, capabilities, resume, heartbeat, all byte identical.

because the server does the classifying, there's nothing to fake on the other side. a normal discord
user just sees a desktop icon.

- two presets, desktop app and browser
- the switch turns the hook off without unloading anything
- the phone has to reconnect before it takes, so restart discord after flipping it
- notifications are unaffected, they go through push registration, not the gateway

`$client_version` still carries the mobile build number. discord doesn't classify on it, but if a
future build starts caring, that field is the first place to look.

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
npm run build        # -> builds/<plugin>/index.js for every folder in src/
npm run dev          # rebuilds while you edit
npm run typecheck
```

classic revenge evals a bundle like this:

```js
(bunny, definePlugin) => { /* bundle */ return plugin?.default ?? plugin }
```

so the build is esbuild with `format: "iife"` and `globalName: "plugin"`, which leaves the export
sitting on a top level `plugin` variable exactly where the loader looks for it.

after building, bump the version in `builds/<id>/manifest.json` **and** in `repo.json`. revenge
compares the two when it checks for updates and ignores anything that isn't higher.

## layout

```
repo.json                     what the plugin browser fetches first
builds/
  ghost-ping/
    manifest.json             id, version, entry point
    index.js                  the built bundle, committed on purpose
  platform-spoofer/
    manifest.json
    index.js
src/
  ghost-ping/                 flux listener and the delete logic
  platform-spoofer/           gateway identify rewrite
build.mjs
```

`builds/` is what gets served, `src/` never is. github pages is pointed at the repo root, so both
live side by side.
