# Ruin plugins

plain vendetta-format plugins for revenge classic. one folder per plugin, install each one straight
from its url, no repository list needed.

```
https://ruinstudiooo.github.io/revenge-plugins/GhostPing/
https://ruinstudiooo.github.io/revenge-plugins/PlatformSpoofer/
```

paste that in revenge, settings > plugins, where it asks for a source. revenge pulls
`<url>/manifest.json` and `<url>/index.js`, checks the hash, done.

## platform spoofer

makes your phone report itself as the desktop app, so everyone sees the desktop icon instead of the
phone one, including people on stock discord.

discord decides this on the server from the identify frame, the one the gateway sends right after
connecting:

```json
{ "op": 2, "d": { "properties": { "$browser": "Discord Android", "$device": "Pixel 7" } } }
```

`$browser` and `$device` are what the server reads. the plugin hooks `WebSocket.prototype.send`,
catches that frame, swaps the properties for a desktop set, and lets everything else through
untouched. token, presence, heartbeat, resume, all byte identical.

- desktop app or browser preset
- the phone has to reconnect, so restart discord after flipping the switch
- notifications keep working, push is registered separately from the gateway

`$client_version` still says the mobile build number. discord doesn't classify on it today, but if a
future build starts caring, that is the first place to look.

## ghost ping

someone pings you, then deletes the message to pretend nothing happened. toast with who did it and
what it said.

- `MESSAGE_CREATE` keeps the last 200 messages, because the delete event only carries an id
- `MESSAGE_DELETE` looks that id up and decides if it was aimed at me
- skips my own messages, bots, and deletes older than 15 minutes

settings page has the master switch, @everyone / @here, the bot filter, and 5m / 15m / 1h / any.

## build

```sh
npm install
npm run build        # rewrites <Plugin>/index.js and <Plugin>/manifest.json
npm run dev          # rebuilds while you edit
npm run typecheck
```

the build does three things per plugin:

1. bundles `src/<Plugin>/index.ts` with esbuild, iife, `globalName: "plugin"`
2. wraps it so the file is one expression, because revenge evals it as `vendetta => { return <file> }`
3. writes the sha256 of the result into `manifest.json`

the hash is generated, never typed. don't hand edit it, just rerun the build.

## layout

```
GhostPing/
  manifest.json      name, authors, main, icon, hash
  index.js           built, committed on purpose, this is what gets served
PlatformSpoofer/
  manifest.json
  index.js
src/
  GhostPing/         index.ts, settings.ts, shared.ts
  PlatformSpoofer/   index.ts, settings.ts, identify.ts, shared.ts
build.mjs
```

`src/` is never served, the plugin folders are. pages points at the repo root so both are public.
