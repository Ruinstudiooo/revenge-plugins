(function(){"use strict";
var plugin = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/MemeMaker/index.ts
  var index_exports = {};
  __export(index_exports, {
    default: () => index_default
  });

  // src/MemeMaker/shared.ts
  var DefaultSettings = {
    meme: true,
    memetext: true
  };
  function store() {
    var _a, _b;
    return (_b = (_a = vendetta.plugin).storage) != null ? _b : _a.storage = {};
  }
  function readSettings() {
    return { ...DefaultSettings, ...store() };
  }
  function writeSettings(patch) {
    Object.assign(store(), patch);
    notifyChange();
  }
  var changed;
  function bindChange(fn) {
    changed = fn;
  }
  function notifyChange() {
    try {
      changed == null ? void 0 : changed();
    } catch {
    }
  }

  // src/MemeMaker/settings.ts
  function SettingsScreen() {
    const React = vendetta.metro.common.React;
    const RN = vendetta.metro.common.ReactNative;
    const [state, setState] = React.useState(() => readSettings());
    const update = (patch) => {
      writeSettings(patch);
      setState({ ...state, ...patch });
    };
    const row = (key, label, sub) => React.createElement(
      RN.View,
      { key, style: styles.row },
      React.createElement(
        RN.View,
        { style: styles.texts },
        React.createElement(RN.Text, { style: styles.label }, label),
        React.createElement(RN.Text, { style: styles.sub }, sub)
      ),
      React.createElement(RN.Switch, {
        value: Boolean(state[key]),
        onValueChange: (value) => update({ [key]: value })
      })
    );
    return React.createElement(
      RN.ScrollView,
      { style: styles.screen, contentContainerStyle: styles.content },
      row("meme", "/meme", "any template, top and bottom text, or a random one"),
      row("memetext", "/memetext", "writes on the last picture posted in the channel"),
      React.createElement(
        RN.Text,
        { style: styles.note },
        "images are rendered by memegen.link, so both commands need internet. the result arrives as a link, discord turns it into the picture."
      ),
      React.createElement(
        RN.Text,
        { style: styles.note },
        "turning one off removes it from the slash picker right away. if it stays visible, close and reopen the picker."
      )
    );
  }
  var styles = {
    screen: { flex: 1 },
    content: { padding: 16, gap: 4 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 12
    },
    texts: { flex: 1, gap: 2 },
    label: { color: "#f2f3f5", fontSize: 16, fontWeight: "500" },
    sub: { color: "#a3a6aa", fontSize: 13 },
    note: { color: "#7f8489", fontSize: 12, marginTop: 12, lineHeight: 17 }
  };

  // src/MemeMaker/templates.ts
  var Templates = [
    "drake",
    "disastergirl",
    "doge",
    "fine",
    "fry",
    "gru",
    "harold",
    "interesting",
    "icanhas",
    "imsorry",
    "joker",
    "keanu",
    "kermit",
    "khaby-lame",
    "michael-scott",
    "money",
    "mordor",
    "morpheus",
    "older",
    "panik-kalm-panik",
    "patrick",
    "philosoraptor",
    "pigeon",
    "pooh",
    "rollsafe",
    "sadfrog",
    "saltbae",
    "seagull",
    "snek",
    "spiderman",
    "spongebob",
    "stonks",
    "stop-it",
    "success",
    "trump",
    "yodawg",
    "yuno",
    "facepalm",
    "feelsgood",
    "woman-cat",
    "wonka",
    "buzz",
    "cake",
    "captain",
    "astronaut",
    "aag"
  ];
  function randomTemplate() {
    return Templates[Math.floor(Math.random() * Templates.length)];
  }
  function cleanTemplate(input) {
    return input.trim().toLowerCase().replace(/\s+/g, "-").replace(/^\/+|\/+$/g, "");
  }

  // src/MemeMaker/meme.ts
  var Base = "https://api.memegen.link/images";
  function memeUrl(template, top, bottom) {
    const name = cleanTemplate(template) || randomTemplate();
    const segments = [];
    if (top) segments.push(encode(top));
    else if (bottom) segments.push("_");
    if (bottom) segments.push(encode(bottom));
    const path = segments.length ? `/${segments.join("/")}` : "";
    return `${Base}/${name}${path}.png?width=600&font=impact`;
  }
  function customUrl(background, top, bottom) {
    const query = `background=${encodeURIComponent(background)}&width=600&font=impact`;
    return `${Base}/custom/${top ? encode(top) : "_"}/${bottom ? encode(bottom) : "_"}.png?${query}`;
  }
  function encode(text) {
    return encodeURIComponent(text.trim());
  }
  function looksLikeImage(type, url) {
    if (type == null ? void 0 : type.startsWith("image/")) return true;
    if (!url) return false;
    return /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(url);
  }
  function messageStore() {
    const metro = vendetta == null ? void 0 : vendetta.metro;
    if (!metro) return void 0;
    const probes = [
      () => {
        var _a;
        return (_a = metro.findByStoreName) == null ? void 0 : _a.call(metro, "MessageStore");
      },
      () => {
        var _a;
        return (_a = metro.findByName) == null ? void 0 : _a.call(metro, "MessageStore");
      },
      () => {
        var _a;
        return (_a = metro.findByProps) == null ? void 0 : _a.call(metro, "getMessages", "getMessage");
      }
    ];
    for (const probe of probes) {
      try {
        const store2 = probe();
        if (store2 == null ? void 0 : store2.getMessages) return store2;
      } catch {
      }
    }
    return void 0;
  }
  function toList(messages) {
    if (!messages) return [];
    if (Array.isArray(messages)) return messages;
    if (typeof messages.toArray === "function") return messages.toArray();
    if (Array.isArray(messages._array)) return messages._array;
    return [];
  }
  function lastImageUrl(channelId) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!channelId) return void 0;
    try {
      const list = toList((_a = messageStore()) == null ? void 0 : _a.getMessages(channelId));
      for (let i = list.length - 1; i >= 0; i--) {
        const message = list[i];
        for (const file of (_b = message == null ? void 0 : message.attachments) != null ? _b : []) {
          const url = (_c = file == null ? void 0 : file.url) != null ? _c : file == null ? void 0 : file.proxy_url;
          if (looksLikeImage(file == null ? void 0 : file.content_type, url)) return url;
        }
        for (const embed of (_d = message == null ? void 0 : message.embeds) != null ? _d : []) {
          const url = (_g = (_e = embed == null ? void 0 : embed.image) == null ? void 0 : _e.url) != null ? _g : (_f = embed == null ? void 0 : embed.thumbnail) == null ? void 0 : _f.url;
          if (url) return url;
        }
      }
    } catch {
    }
    return void 0;
  }
  function readOptions(args) {
    const out = {};
    const walk = (list) => {
      for (const arg of list != null ? list : []) {
        if ((arg == null ? void 0 : arg.name) && typeof arg.value === "string") out[arg.name] = arg.value;
        if (arg == null ? void 0 : arg.options) walk(arg.options);
      }
    };
    walk(args);
    return out;
  }

  // src/MemeMaker/index.ts
  var Str = 3;
  var disposers = [];
  var announced = false;
  function toast(message) {
    try {
      vendetta.ui.toasts.showToast(message);
    } catch {
    }
    console.log(`[meme-maker] ${message}`);
  }
  function fail(where, error) {
    var _a;
    const text = (_a = error == null ? void 0 : error.message) != null ? _a : String(error);
    console.error(`[meme-maker] ${where}`, error);
    toast(`meme maker ${where}: ${text}`.slice(0, 180));
  }
  function guarded(run) {
    var _a;
    try {
      return run();
    } catch (error) {
      console.error("[meme-maker] execute failed", error);
      return { content: `meme maker broke: ${(_a = error == null ? void 0 : error.message) != null ? _a : error}` };
    }
  }
  function memeCommand() {
    return {
      name: "meme",
      description: "make a meme",
      options: [
        {
          name: "template",
          description: "template id like drake or stonks, blank picks a random one",
          type: Str,
          required: false
        },
        { name: "top", description: "top line", type: Str, required: false },
        { name: "bottom", description: "bottom line", type: Str, required: false }
      ],
      execute(args) {
        return guarded(() => {
          var _a, _b, _c;
          const opts = readOptions(args);
          return { content: memeUrl((_a = opts.template) != null ? _a : "", (_b = opts.top) != null ? _b : "", (_c = opts.bottom) != null ? _c : "") };
        });
      }
    };
  }
  function memeTextCommand() {
    return {
      name: "memetext",
      description: "put text on the last image posted in this channel",
      options: [
        { name: "text", description: "what the picture should say", type: Str, required: true },
        { name: "top", description: "separate line above it", type: Str, required: false },
        { name: "image", description: "image url, if not the last one in the channel", type: Str, required: false }
      ],
      execute(args, ctx) {
        return guarded(() => {
          var _a, _b, _c, _d, _e, _f, _g;
          const opts = readOptions(args);
          const text = ((_a = opts.text) != null ? _a : "").trim();
          if (!text) return { content: "give me something to write first" };
          const channel = (_e = (_c = (_b = ctx == null ? void 0 : ctx.channel) == null ? void 0 : _b.id) != null ? _c : ctx == null ? void 0 : ctx.channelId) != null ? _e : (_d = ctx == null ? void 0 : ctx.channel) == null ? void 0 : _d.channelId;
          const background = ((_f = opts.image) == null ? void 0 : _f.trim()) || lastImageUrl(channel);
          if (!background) {
            return { content: "no image in this channel yet. post one, or pass image: with a link." };
          }
          return { content: customUrl(background, (_g = opts.top) != null ? _g : "", text) };
        });
      }
    };
  }
  function register(command) {
    try {
      const dispose = vendetta.commands.registerCommand(command);
      disposers.push(typeof dispose === "function" ? dispose : () => {
      });
      return true;
    } catch (error) {
      fail(`could not add /${command.name}`, error);
      return false;
    }
  }
  function sync() {
    var _a;
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
      }
    }
    disposers = [];
    const settings = readSettings();
    if (typeof ((_a = vendetta == null ? void 0 : vendetta.commands) == null ? void 0 : _a.registerCommand) !== "function") {
      toast("meme maker: this revenge build has no slash command api");
      return;
    }
    const wanted = [];
    if (settings.meme && register(memeCommand())) wanted.push("/meme");
    if (settings.memetext && register(memeTextCommand())) wanted.push("/memetext");
    if (!announced && wanted.length) {
      announced = true;
      toast(`meme maker ready: ${wanted.join(" ")}`);
    }
  }
  var index_default = {
    onLoad() {
      try {
        bindChange(sync);
        sync();
      } catch (error) {
        fail("failed to load", error);
      }
    },
    onUnload() {
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {
        }
      }
      disposers = [];
      bindChange(() => {
      });
    },
    settings: SettingsScreen
  };
  return __toCommonJS(index_exports);
})();

return plugin && (plugin.default || plugin)
})()