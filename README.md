# Ruin plugins

plain vendetta-format plugins for revenge classic. one folder per plugin, install each one straight
from its url, no repository list needed.

```
https://ruinstudiooo.github.io/revenge-plugins/GhostPing/
https://ruinstudiooo.github.io/revenge-plugins/PlatformSpoofer/
https://ruinstudiooo.github.io/revenge-plugins/MemeMaker/
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

## meme maker

adds six entries to the slash picker.

`/meme` takes a template id, a top line and a bottom line. template can be `drake`, `stonks`,
`this is fine`, or anything else from memegen. leave it blank and it picks a random one from a short
built-in list.

```
/meme template:drake top:hello there bottom:general kenobi
```

`/memetext` writes on the last picture posted in the channel. it scans the message store, newest
first, and takes the first image attachment or embed image it finds. `/memetext text:nobody:` turns
that picture into a reaction image.

```
/memetext text:when the plugin works
/memetext top:me: text:nobody:
```

an `image:` option overrides the search if you want a specific url.

`/random` posts a random template, blank or with your two lines.

```
/random
/random top:me bottom:nobody:
```

the three text commands go through groq, so they need one key. paste it in the plugin settings,
it stores on its own as you type and there is a save button too. free key from
`console.groq.com/keys`, it starts with `gsk_`.

one key, one request. `/ask` is a single call to `api.groq.com`, no model list, no key rotation, no
retry chain, so it comes back in a second or two. the only time it sends a second request is when
groq says the model itself was retired, then it falls to `llama-3.1-8b-instant` once.

| command | what it does |
| --- | --- |
| `/ask question:...` | answers the question |
| `/r text:...` | fixes grammar, wording and flow, keeps the language |
| `/shakespeare text:...` | same sentence in early modern english |

```
/r text:he go store yesterday and buyed two bread
/shakespeare text:i am hungry
```

the model defaults to `llama-3.3-70b-versatile`. leave the model field blank for that, or pin another
name from the groq console.

a 401 means the key is wrong or deleted. a 429 means the free limits are busy for a minute, the
plugin says so instead of hammering the api with retries.

images are rendered by `api.memegen.link`, so no image library ships in the bundle and the meme
commands need internet to work.

settings has a switch per command plus the key and model fields. flipping a switch off unregisters
that command from the picker immediately.

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
MemeMaker/
  manifest.json
  index.js
src/
  GhostPing/         index.ts, settings.ts, shared.ts
  PlatformSpoofer/   index.ts, settings.ts, identify.ts, shared.ts
  MemeMaker/         index.ts, settings.ts, shared.ts, meme.ts, templates.ts, groq.ts
build.mjs
```

`src/` is never served, the plugin folders are. pages points at the repo root so both are public.
