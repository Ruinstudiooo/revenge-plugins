# Ruin plugins

my revenge plugins. every folder inside `plugins/` is one plugin, and each one builds into its own zip.

this started from [revenge-plugin-template](https://github.com/revenge-mod/revenge-plugin-template).
heads up, the template itself says revenge next is discontinued and the work moved to
[valenced](https://github.com/Valenced/valenced). everything here still builds and runs on revenge as it is.

## what's in here

### ghost ping

someone pings you, then deletes the message to pretend it never happened. this puts a toast on screen
with who did it and what the message said.

- works off the delete event, so it catches editors deleting their own message too
- settings for @everyone / @here pings, and for how late a delete still counts
- ignores bots and your own messages by default

settings live in the plugin page inside revenge, nothing else to configure.

## build

needs node or bun. the native side needs jdk 25 and the android sdk, but ghost ping is js only so
gradle never has to run for it.

```sh
npm install
npm run build           # every plugin -> plugins/<name>/build/js/index.js
npm run build ghost-ping
```

packaged zips need the full toolchain:

```sh
./gradlew packageAllPlugins
```

## try it before pushing

```sh
npm run serve
```

it builds the index from `build/dist` and serves it on port 8080. add that url as a repository inside
revenge and the plugin shows up like any other.

## layout

```
plugins/
  ghost-ping/
    manifest.json    id, version, entry point
    index.tsx        the plugin itself
    settings.tsx     the settings page
    shared.ts        settings shape and defaults
    tsconfig.json
themes/              empty for now
```
