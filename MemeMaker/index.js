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
    memetext: true,
    random: true,
    ask: true,
    rewrite: true,
    shakespeare: true,
    key: "",
    model: ""
  };
  function store() {
    var _a, _b;
    return (_b = (_a = vendetta.plugin).storage) != null ? _b : _a.storage = {};
  }
  function readSettings() {
    return { ...DefaultSettings, ...store() };
  }
  function readKey() {
    var _a;
    const saved = store();
    const direct = String((_a = saved.key) != null ? _a : "").trim();
    if (direct) return direct;
    for (const raw of [saved.keys, saved.apiKey]) {
      const found = String(raw != null ? raw : "").split(/\s+/).find((part) => part.startsWith("gsk_"));
      if (found) return found;
    }
    return "";
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

  // src/MemeMaker/groq.ts
  var Endpoint = "https://api.groq.com/openai/v1/chat/completions";
  var DefaultModel = "llama-3.3-70b-versatile";
  var BackupModel = "llama-3.1-8b-instant";
  var GroqError = class extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  };
  function pickError(body) {
    var _a, _b, _c;
    try {
      return (_c = (_b = (_a = JSON.parse(body)) == null ? void 0 : _a.error) == null ? void 0 : _b.message) != null ? _c : body;
    } catch {
      return body;
    }
  }
  function missingModel(error) {
    var _a;
    const message = String((_a = error == null ? void 0 : error.message) != null ? _a : "");
    return (error == null ? void 0 : error.status) === 404 || /model[^.]*(decommission|not found|does not exist|no longer)/i.test(message);
  }
  async function call(model, prompt, opts) {
    var _a, _b, _c, _d, _e, _f, _g;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), (_a = opts.timeout) != null ? _a : 2e4);
    let response;
    try {
      response = await fetch(Endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.key.trim()}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: (_b = opts.temperature) != null ? _b : 0.7,
          max_tokens: (_c = opts.maxTokens) != null ? _c : 1024,
          stream: false
        }),
        signal: abort.signal
      });
    } catch (error) {
      if ((error == null ? void 0 : error.name) === "AbortError") throw new Error("groq took too long, try once more");
      throw new Error("groq is not reachable, check the connection");
    } finally {
      clearTimeout(timer);
    }
    const body = await response.text();
    if (!response.ok) {
      const message = pickError(body);
      if (response.status === 401 || response.status === 403) {
        throw new GroqError(response.status, "groq rejected the key, paste a fresh one in the plugin settings");
      }
      if (response.status === 429) {
        throw new GroqError(response.status, `groq is rate limiting right now, give it a moment. ${message}`);
      }
      throw new GroqError(response.status, `groq ${response.status}: ${message}`);
    }
    const data = JSON.parse(body);
    const text = String((_g = (_f = (_e = (_d = data == null ? void 0 : data.choices) == null ? void 0 : _d[0]) == null ? void 0 : _e.message) == null ? void 0 : _f.content) != null ? _g : "").trim();
    if (!text) throw new Error("groq sent an empty answer back");
    return text;
  }
  async function generate(prompt, opts) {
    var _a, _b;
    const key = String((_a = opts.key) != null ? _a : "").trim();
    if (!key) throw new Error("no groq api key saved yet, open the plugin settings and paste one");
    const model = ((_b = opts.model) == null ? void 0 : _b.trim()) || DefaultModel;
    try {
      return await call(model, prompt, opts);
    } catch (error) {
      if (!missingModel(error)) throw error;
      if (model === BackupModel) throw error;
      return call(BackupModel, prompt, opts);
    }
  }
  function shorten(text, max = 1900) {
    const clean = text.trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}\u2026` : clean;
  }

  // src/MemeMaker/settings.ts
  function SettingsScreen() {
    var _a, _b, _c, _d;
    const React = vendetta.metro.common.React;
    const RN = vendetta.metro.common.ReactNative;
    const [state, setState] = React.useState(() => readSettings());
    const [key, setKey] = React.useState(String((_a = state.key) != null ? _a : ""));
    const [model, setModel] = React.useState(String((_b = state.model) != null ? _b : ""));
    const [savedAt, setSavedAt] = React.useState(0);
    const keyTimer = React.useRef(null);
    const modelTimer = React.useRef(null);
    const latestKey = React.useRef(String((_c = state.key) != null ? _c : ""));
    const latestModel = React.useRef(String((_d = state.model) != null ? _d : ""));
    const toggle = (name) => {
      const next = !state[name];
      writeSettings({ [name]: next });
      setState({ ...state, [name]: next });
    };
    const onChangeKey = (text) => {
      latestKey.current = text;
      setKey(text);
      if (keyTimer.current) clearTimeout(keyTimer.current);
      keyTimer.current = setTimeout(() => {
        writeSettings({ key: latestKey.current.trim() });
        setSavedAt(Date.now());
      }, 600);
    };
    const onChangeModel = (text) => {
      latestModel.current = text;
      setModel(text);
      if (modelTimer.current) clearTimeout(modelTimer.current);
      modelTimer.current = setTimeout(() => {
        writeSettings({ model: latestModel.current.trim() });
        setSavedAt(Date.now());
      }, 600);
    };
    const save = () => {
      if (keyTimer.current) clearTimeout(keyTimer.current);
      if (modelTimer.current) clearTimeout(modelTimer.current);
      const cleanKey = latestKey.current.trim();
      const cleanModel = latestModel.current.trim();
      latestKey.current = cleanKey;
      latestModel.current = cleanModel;
      setKey(cleanKey);
      setModel(cleanModel);
      writeSettings({ key: cleanKey, model: cleanModel });
      setState({ ...state, key: cleanKey, model: cleanModel });
      setSavedAt(Date.now());
    };
    const row = (name, label, sub) => React.createElement(
      RN.View,
      { key: name, style: styles.row },
      React.createElement(
        RN.View,
        { style: styles.texts },
        React.createElement(RN.Text, { style: styles.label }, label),
        React.createElement(RN.Text, { style: styles.sub }, sub)
      ),
      React.createElement(RN.Switch, { value: Boolean(state[name]), onValueChange: () => toggle(name) })
    );
    const field = (config) => React.createElement(
      RN.View,
      { key: config.label, style: styles.field },
      React.createElement(RN.Text, { style: styles.label }, config.label),
      React.createElement(RN.TextInput, {
        style: styles.input,
        value: config.value,
        placeholder: config.placeholder,
        placeholderTextColor: "#6b6f76",
        autoCapitalize: "none",
        autoCorrect: false,
        secureTextEntry: config.label === "api key",
        onChangeText: config.onChange,
        onBlur: config.onBlur,
        onSubmitEditing: config.onBlur
      }),
      config.hint ? React.createElement(RN.Text, { style: styles.hint }, config.hint) : null
    );
    const looksRight = key.trim().startsWith("gsk_");
    return React.createElement(
      RN.ScrollView,
      { style: styles.screen, contentContainerStyle: styles.content },
      React.createElement(RN.Text, { style: styles.section }, "commands"),
      row("meme", "/meme", "any template, top and bottom text, or a random one"),
      row("memetext", "/memetext", "writes on the last picture posted in the channel"),
      row("random", "/random", "posts a random meme"),
      row("ask", "/ask", "asks groq a question"),
      row("rewrite", "/r", "fixes grammar and wording"),
      row("shakespeare", "/shakespeare", "rewrites your line like shakespeare"),
      React.createElement(RN.Text, { style: styles.section }, "groq"),
      field({
        label: "api key",
        value: key,
        placeholder: "gsk_...",
        onChange: onChangeKey,
        onBlur: save,
        hint: key.trim() ? looksRight ? "looks like a groq key. one key, one request, no queue" : "groq keys start with gsk_, this one does not" : "paste your key, it saves as you type"
      }),
      field({
        label: "model",
        value: model,
        placeholder: DefaultModel,
        onChange: onChangeModel,
        onBlur: save,
        hint: `blank uses ${DefaultModel}`
      }),
      React.createElement(
        RN.Pressable,
        { onPress: save, style: styles.button },
        React.createElement(RN.Text, { style: styles.buttonText }, "save")
      ),
      savedAt ? React.createElement(RN.Text, { style: styles.hint }, "saved, go run a command") : null,
      React.createElement(
        RN.Text,
        { style: styles.note },
        "free key from console.groq.com/keys. it stays in this plugin storage on your phone and only goes to groq."
      ),
      React.createElement(
        RN.Text,
        { style: styles.note },
        "no key rotation any more. one key, one call, so a command answers in a second or two instead of trying every model and key in turn."
      ),
      React.createElement(
        RN.Text,
        { style: styles.note },
        "images come from memegen.link, so the meme commands need internet. turning one off removes it from the slash picker right away."
      )
    );
  }
  var styles = {
    screen: { flex: 1 },
    content: { padding: 16, gap: 4, paddingBottom: 40 },
    section: {
      color: "#7f8489",
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      marginTop: 16,
      marginBottom: 4
    },
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
    field: { gap: 6, paddingVertical: 10 },
    input: {
      backgroundColor: "#2b2d31",
      color: "#f2f3f5",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15
    },
    button: {
      alignSelf: "flex-start",
      backgroundColor: "#5865f2",
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 9,
      marginTop: 2,
      marginBottom: 6
    },
    buttonText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
    hint: { color: "#7f8489", fontSize: 12, lineHeight: 16 },
    note: { color: "#7f8489", fontSize: 12, marginTop: 10, lineHeight: 17 }
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
  function selectedChannel() {
    var _a, _b, _c, _d, _e;
    try {
      return (_e = (_d = (_c = (_b = (_a = vendetta.metro).findByProps) == null ? void 0 : _b.call(_a, "getChannelId", "getLastSelectedChannelId")) == null ? void 0 : _c.getChannelId) == null ? void 0 : _d.call(_c)) != null ? _e : void 0;
    } catch {
      return void 0;
    }
  }
  function channelOf(ctx) {
    var _a, _b, _c, _d, _e;
    return (_e = (_c = (_b = selectedChannel()) != null ? _b : (_a = ctx == null ? void 0 : ctx.channel) == null ? void 0 : _a.id) != null ? _c : ctx == null ? void 0 : ctx.channelId) != null ? _e : (_d = ctx == null ? void 0 : ctx.channel) == null ? void 0 : _d.channelId;
  }
  var DEBUG = false;
  function trace(message) {
    if (DEBUG) toast(message);
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async function landed(channelId, content) {
    var _a, _b, _c, _d, _e;
    try {
      const store2 = (_b = (_a = vendetta.metro).findByProps) == null ? void 0 : _b.call(_a, "getMessage", "getMessages");
      if (!(store2 == null ? void 0 : store2.getMessages)) return void 0;
      const raw = store2.getMessages(channelId);
      if (!raw) return void 0;
      const list = Array.isArray(raw) ? raw : (_d = (_c = raw.toArray) == null ? void 0 : _c.call(raw)) != null ? _d : raw._array;
      if (!Array.isArray(list)) return void 0;
      for (let i = list.length - 1; i >= 0 && i >= list.length - 8; i--) {
        if (((_e = list[i]) == null ? void 0 : _e.content) === content) return true;
      }
      return false;
    } catch {
      return void 0;
    }
  }
  function channelLoaded(channelId) {
    var _a, _b, _c, _d, _e;
    try {
      const store2 = (_e = (_b = (_a = vendetta.metro).findByProps) == null ? void 0 : _b.call(_a, "getChannel", "getDMFromUserId")) != null ? _e : (_d = (_c = vendetta.metro).findByProps) == null ? void 0 : _d.call(_c, "getChannel");
      if (!(store2 == null ? void 0 : store2.getChannel)) return void 0;
      return Boolean(store2.getChannel(channelId));
    } catch {
      return void 0;
    }
  }
  function copyToClipboard(text) {
    var _a, _b, _c, _d, _e;
    try {
      const clipboard = (_d = (_a = vendetta.metro.common) == null ? void 0 : _a.clipboard) != null ? _d : (_c = (_b = vendetta.metro).findByProps) == null ? void 0 : _c.call(_b, "setString", "getString", "hasString");
      (_e = clipboard == null ? void 0 : clipboard.setString) == null ? void 0 : _e.call(clipboard, text);
      return true;
    } catch {
      return false;
    }
  }
  async function deliver(ctx, content) {
    var _a, _b, _c;
    const channelId = channelOf(ctx);
    if (!channelId) {
      trace("meme maker: no channel in the command context");
      return { content };
    }
    const known = channelLoaded(channelId);
    trace(`meme maker: channel ${known === void 0 ? "unknown" : known ? "ok" : "not loaded"}`);
    const payload = { content, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] };
    const senders = [
      () => {
        var _a2, _b2, _c2;
        return (_c2 = (_b2 = (_a2 = vendetta.metro).findByProps) == null ? void 0 : _b2.call(_a2, "sendMessage", "editMessage")) == null ? void 0 : _c2.sendMessage;
      },
      () => {
        var _a2, _b2, _c2;
        return (_c2 = (_b2 = (_a2 = vendetta.metro).findByProps) == null ? void 0 : _b2.call(_a2, "sendMessage", "receiveMessage")) == null ? void 0 : _c2.sendMessage;
      }
    ];
    for (const get of senders) {
      try {
        const send = get();
        if (typeof send !== "function") continue;
        await send(channelId, payload);
        await sleep(400);
        if (await landed(channelId, content) !== false) {
          trace("meme maker: posted");
          return void 0;
        }
        console.error("[meme-maker] sendMessage resolved but nothing landed");
      } catch (error) {
        console.error("[meme-maker] sendMessage failed", error);
      }
    }
    try {
      const bot = (_c = (_b = (_a = vendetta.metro).findByProps) == null ? void 0 : _b.call(_a, "sendBotMessage")) == null ? void 0 : _c.sendBotMessage;
      if (typeof bot === "function") {
        await bot(channelId, payload);
        await sleep(400);
        if (await landed(channelId, content) !== false) {
          trace("meme maker: posted as bot message");
          return void 0;
        }
        console.error("[meme-maker] sendBotMessage resolved but nothing landed");
      }
    } catch (error) {
      console.error("[meme-maker] sendBotMessage failed", error);
    }
    if (copyToClipboard(content)) {
      trace("meme maker: nothing landed, link copied instead");
    } else {
      trace("meme maker: could not post or copy");
    }
    return { content };
  }
  async function guarded(name, ctx, run) {
    var _a;
    trace(`meme maker: /${name} ran`);
    try {
      return await deliver(ctx, await run());
    } catch (error) {
      console.error("[meme-maker] execute failed", error);
      const text = `meme maker: ${(_a = error == null ? void 0 : error.message) != null ? _a : error}`;
      try {
        return await deliver(ctx, text);
      } catch {
        return { content: text };
      }
    }
  }
  function aiCommand(config) {
    return {
      name: config.name,
      displayName: config.name,
      description: config.description,
      displayDescription: config.description,
      applicationId: "-1",
      type: 1,
      inputType: 1,
      options: [
        {
          name: config.option,
          displayName: config.option,
          description: config.optionDescription,
          displayDescription: config.optionDescription,
          type: Str,
          required: true
        }
      ],
      execute(args, ctx) {
        return guarded(config.name, ctx, async () => {
          var _a;
          const opts = readOptions(args);
          const text = ((_a = opts[config.option]) != null ? _a : "").trim();
          if (!text) return `type something after /${config.name}`;
          const settings = readSettings();
          const key = readKey();
          toast(key ? "meme maker: asking groq" : "meme maker: no groq key saved");
          const answer = await generate(config.build(text), {
            key,
            model: settings.model,
            temperature: config.temperature
          });
          return shorten(answer);
        });
      }
    };
  }
  function randomCommand() {
    return {
      name: "random",
      displayName: "random",
      description: "post a random meme, with your text if you give any",
      displayDescription: "post a random meme, with your text if you give any",
      applicationId: "-1",
      type: 1,
      inputType: 1,
      options: [
        { name: "top", displayName: "top", description: "top line", displayDescription: "top line", type: Str, required: false },
        {
          name: "bottom",
          displayName: "bottom",
          description: "bottom line",
          displayDescription: "bottom line",
          type: Str,
          required: false
        }
      ],
      execute(args, ctx) {
        return guarded("random", ctx, () => {
          var _a, _b;
          const opts = readOptions(args);
          return memeUrl(randomTemplate(), (_a = opts.top) != null ? _a : "", (_b = opts.bottom) != null ? _b : "");
        });
      }
    };
  }
  function memeCommand() {
    return {
      name: "meme",
      displayName: "meme",
      description: "make a meme",
      displayDescription: "make a meme",
      applicationId: "-1",
      type: 1,
      inputType: 1,
      options: [
        {
          name: "template",
          displayName: "template",
          description: "template id like drake or stonks, blank picks a random one",
          displayDescription: "template id like drake or stonks, blank picks a random one",
          type: Str,
          required: false
        },
        { name: "top", displayName: "top", description: "top line", displayDescription: "top line", type: Str, required: false },
        {
          name: "bottom",
          displayName: "bottom",
          description: "bottom line",
          displayDescription: "bottom line",
          type: Str,
          required: false
        }
      ],
      execute(args, ctx) {
        return guarded("meme", ctx, () => {
          var _a, _b, _c;
          const opts = readOptions(args);
          return memeUrl((_a = opts.template) != null ? _a : "", (_b = opts.top) != null ? _b : "", (_c = opts.bottom) != null ? _c : "");
        });
      }
    };
  }
  function memeTextCommand() {
    return {
      name: "memetext",
      displayName: "memetext",
      description: "put text on the last image posted in this channel",
      displayDescription: "put text on the last image posted in this channel",
      applicationId: "-1",
      type: 1,
      inputType: 1,
      options: [
        {
          name: "text",
          displayName: "text",
          description: "what the picture should say",
          displayDescription: "what the picture should say",
          type: Str,
          required: true
        },
        { name: "top", displayName: "top", description: "separate line above it", displayDescription: "separate line above it", type: Str, required: false },
        {
          name: "image",
          displayName: "image",
          description: "image url, if not the last one in the channel",
          displayDescription: "image url, if not the last one in the channel",
          type: Str,
          required: false
        }
      ],
      execute(args, ctx) {
        return guarded("memetext", ctx, () => {
          var _a, _b, _c;
          const opts = readOptions(args);
          const text = ((_a = opts.text) != null ? _a : "").trim();
          if (!text) return "give me something to write first";
          const background = ((_b = opts.image) == null ? void 0 : _b.trim()) || lastImageUrl(channelOf(ctx));
          if (!background) {
            return "no image in this channel yet. post one, or pass image: with a link.";
          }
          return customUrl(background, (_c = opts.top) != null ? _c : "", text);
        });
      }
    };
  }
  function askCommand() {
    return aiCommand({
      name: "ask",
      description: "ask groq anything",
      option: "question",
      optionDescription: "what you want to know",
      build: (text) => `You are answering a question inside a discord chat. Be direct, useful and as short as the question allows. Do not repeat the question back.

${text}`,
      temperature: 0.6
    });
  }
  function rewriteCommand() {
    return aiCommand({
      name: "r",
      description: "rewrite your sentence with correct grammar and better words",
      option: "text",
      optionDescription: "the sentence to fix",
      build: (text) => `Rewrite the text below with correct grammar, natural phrasing and better word choice. Keep the meaning, the tone and the language it is written in. Reply with the rewritten text only, no quotes, no explanation, no notes.

${text}`,
      temperature: 0.4
    });
  }
  function shakespeareCommand() {
    return aiCommand({
      name: "shakespeare",
      description: "rewrite your sentence like shakespeare",
      option: "text",
      optionDescription: "the sentence to rewrite",
      build: (text) => `Rewrite the text below in the voice of William Shakespeare: early modern english, thee and thou, inverted phrasing, a little dramatic flourish. Keep the meaning. Reply with the rewritten text only, no quotes, no explanation, no notes.

${text}`,
      temperature: 0.8
    });
  }
  function register(command) {
    try {
      const dispose = vendetta.commands.registerCommand(command);
      disposers.push(typeof dispose === "function" ? dispose : () => {
      });
      if (Number.isNaN(Number(command.id))) {
        trace(`meme maker: /${command.name} got a bad id (${command.id})`);
      }
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
    if (settings.random && register(randomCommand())) wanted.push("/random");
    if (settings.ask && register(askCommand())) wanted.push("/ask");
    if (settings.rewrite && register(rewriteCommand())) wanted.push("/r");
    if (settings.shakespeare && register(shakespeareCommand())) wanted.push("/shakespeare");
    if (!announced && wanted.length) {
      announced = true;
      trace(`meme maker ready: ${wanted.join(" ")}`);
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