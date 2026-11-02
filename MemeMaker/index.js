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

  // src/MemeMaker/gemini.ts
  var Base = "https://generativelanguage.googleapis.com/v1beta/models";
  var StaticFallbacks = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite"
  ];
  var modelCache = /* @__PURE__ */ new Map();
  var dry = /* @__PURE__ */ new Map();
  function retryAfter(body) {
    var _a, _b, _c;
    const fallback = 10 * 60 * 1e3;
    const ceiling = 6 * 3600 * 1e3;
    const floor = 5 * 1e3;
    try {
      const details = (_c = (_b = (_a = JSON.parse(body)) == null ? void 0 : _a.error) == null ? void 0 : _b.details) != null ? _c : [];
      for (const detail of details) {
        const raw = detail == null ? void 0 : detail.retryDelay;
        if (typeof raw === "string" && /^\d+(\.\d+)?s$/.test(raw)) {
          return Math.min(Math.max(parseFloat(raw) * 1e3, floor), ceiling);
        }
      }
    } catch {
    }
    const match = /retry in ([0-9hms.]+)/i.exec(body);
    if (match) {
      let ms = 0;
      const units = /([\d.]+)([hms])/g;
      let part;
      while (part = units.exec(match[1])) {
        const n = parseFloat(part[1]);
        if (!Number.isFinite(n)) continue;
        ms += part[2] === "h" ? n * 36e5 : part[2] === "m" ? n * 6e4 : n * 1e3;
      }
      if (ms > 0) return Math.min(Math.max(ms, floor), ceiling);
    }
    return fallback;
  }
  function noteDry(key, model, body, message) {
    dry.set(`${key}:${model}`, { until: Date.now() + retryAfter(body), message });
  }
  function dryNote(key, model) {
    const entry = dry.get(`${key}:${model}`);
    if (!entry) return void 0;
    if (entry.until <= Date.now()) {
      dry.delete(`${key}:${model}`);
      return void 0;
    }
    return entry.message;
  }
  var preferred = 0;
  function parseKeys(raw) {
    return String(raw != null ? raw : "").split(/[\s,]+/).map((key) => key.trim()).filter(Boolean).filter((key, index, all) => all.indexOf(key) === index);
  }
  function shortName(name) {
    return String(name != null ? name : "").replace(/^models\//, "");
  }
  function pickError(body) {
    var _a, _b, _c;
    try {
      return (_c = (_b = (_a = JSON.parse(body)) == null ? void 0 : _a.error) == null ? void 0 : _b.message) != null ? _c : body;
    } catch {
      return body;
    }
  }
  async function request(url, init, timeout) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeout);
    try {
      return await fetch(url, { ...init, signal: abort.signal });
    } catch (error) {
      if ((error == null ? void 0 : error.name) === "AbortError") throw new Error("gemini took too long to answer");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async function availableModels(key, timeout) {
    var _a;
    const cached = modelCache.get(key);
    if (cached == null ? void 0 : cached.length) return cached;
    try {
      const response = await request(`${Base}?key=${encodeURIComponent(key)}&pageSize=1000`, { method: "GET" }, timeout);
      if (!response.ok) return void 0;
      const data = JSON.parse(await response.text());
      const list = ((_a = data == null ? void 0 : data.models) != null ? _a : []).filter((model) => {
        var _a2, _b;
        const methods = (_b = (_a2 = model == null ? void 0 : model.supportedGenerationMethods) != null ? _a2 : model == null ? void 0 : model.supportedActions) != null ? _b : [];
        return Array.isArray(methods) && methods.includes("generateContent");
      }).map((model) => shortName(model == null ? void 0 : model.name)).filter(Boolean);
      if (!list.length) return void 0;
      modelCache.set(key, list);
      return list;
    } catch {
      return void 0;
    }
  }
  function chooseModels(available, wanted) {
    const name = (wanted != null ? wanted : "").trim();
    const list = (available == null ? void 0 : available.length) ? available : StaticFallbacks;
    const out = [];
    const push = (model) => {
      if (model && !out.includes(model)) out.push(model);
    };
    if (name && list.includes(name)) push(name);
    for (const model of list) {
      if (/flash/i.test(model) && !/thinking|exp|preview|learnlm/i.test(model)) push(model);
    }
    if (name && !out.includes(name)) push(name);
    for (const model of list) push(model);
    return out.length ? out : [name || StaticFallbacks[0]];
  }
  function supportsThinking(model) {
    return /2\.5/i.test(model);
  }
  function httpError(status, message) {
    return new Error(`gemini ${status}: ${message}`);
  }
  async function call(key, model, prompt, opts, thinking) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    const url = `${Base}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const generationConfig = {
      temperature: (_a = opts.temperature) != null ? _a : 0.7,
      maxOutputTokens: (_b = opts.maxTokens) != null ? _b : 1024
    };
    if (thinking && supportsThinking(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    let response;
    try {
      response = await request(
        url,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig
          })
        },
        (_c = opts.timeout) != null ? _c : 3e4
      );
    } catch (error) {
      return { retryKey: true, error: error instanceof Error ? error : new Error("gemini did not answer") };
    }
    const body = await response.text();
    if (!response.ok) {
      const message = pickError(body);
      if (response.status === 400 || response.status === 404) return { retryModel: true };
      if (response.status === 429) {
        console.error(`[meme-maker] gemini 429 on ${model}`);
        noteDry(key, model, body, `gemini 429: ${message}`);
        return { retryModel: true, quota: true, error: httpError(429, message) };
      }
      console.error(`[meme-maker] gemini ${response.status}: ${message}`);
      if (response.status === 401 || response.status === 403 || response.status >= 500) {
        return { retryKey: true, error: httpError(response.status, message) };
      }
      throw new Error(`gemini ${response.status}: ${message}`);
    }
    const data = JSON.parse(body);
    const text = ((_g = (_f = (_e = (_d = data == null ? void 0 : data.candidates) == null ? void 0 : _d[0]) == null ? void 0 : _e.content) == null ? void 0 : _f.parts) != null ? _g : []).map((part) => {
      var _a2;
      return (_a2 = part == null ? void 0 : part.text) != null ? _a2 : "";
    }).join("").trim();
    if (!text) {
      const blocked = (_k = (_h = data == null ? void 0 : data.promptFeedback) == null ? void 0 : _h.blockReason) != null ? _k : (_j = (_i = data == null ? void 0 : data.candidates) == null ? void 0 : _i[0]) == null ? void 0 : _j.finishReason;
      throw new Error(blocked ? `gemini refused (${blocked})` : "gemini sent an empty answer back");
    }
    return { text };
  }
  async function generate(prompt, opts) {
    var _a, _b, _c, _d;
    const keys = parseKeys(opts.keys.join(" "));
    if (!keys.length) throw new Error("no gemini api key saved yet, open the plugin settings and paste one");
    const timeout = (_a = opts.timeout) != null ? _a : 3e4;
    let lastError;
    let tried = 0;
    let allQuota = true;
    for (let step = 0; step < keys.length; step++) {
      const index = (preferred + step) % keys.length;
      const key = keys[index];
      const all = chooseModels(await availableModels(key, timeout), opts.model);
      tried++;
      const models = all.filter((model) => !dryNote(key, model));
      if (!models.length) {
        lastError = new Error((_b = dryNote(key, all[0])) != null ? _b : "gemini is out of quota");
        continue;
      }
      for (const model of models) {
        let result;
        try {
          result = await call(key, model, prompt, opts, true);
        } catch (error) {
          lastError = error;
          allQuota = false;
          try {
            result = await call(key, model, prompt, { ...opts, temperature: 0.4 }, true);
          } catch (retry) {
            lastError = retry;
            continue;
          }
        }
        if ("text" in result) {
          preferred = index;
          return result.text;
        }
        allQuota = allQuota && Boolean(result.quota);
        lastError = (_c = result.error) != null ? _c : new Error(result.quota ? "gemini is out of quota" : `gemini does not have ${model} on this key`);
        if ("retryKey" in result) break;
      }
    }
    const detail = (_d = lastError == null ? void 0 : lastError.message) != null ? _d : "no answer";
    const count = `${tried} key${tried === 1 ? "" : "s"}`;
    const hint = allQuota ? "\ngoogle gives the free tier out per project and model, so keys made under the same project share the same 20 a day. make the extra keys on another google account, or turn on billing for that project." : "";
    throw new Error(`${detail} (tried ${count})${hint}`);
  }
  function shorten(text, max = 1900) {
    const clean = text.trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}\u2026` : clean;
  }

  // src/MemeMaker/shared.ts
  var DefaultSettings = {
    meme: true,
    memetext: true,
    random: true,
    ask: true,
    rewrite: true,
    shakespeare: true,
    keys: "",
    model: "gemini-2.5-flash"
  };
  function store() {
    var _a, _b;
    return (_b = (_a = vendetta.plugin).storage) != null ? _b : _a.storage = {};
  }
  function readSettings() {
    return { ...DefaultSettings, ...store() };
  }
  function readKeys() {
    var _a, _b;
    const saved = store();
    return parseKeys((_b = (_a = saved.keys) != null ? _a : saved.apiKey) != null ? _b : "");
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
    var _a, _b, _c, _d;
    const React = vendetta.metro.common.React;
    const RN = vendetta.metro.common.ReactNative;
    const [state, setState] = React.useState(() => readSettings());
    const [keys, setKeys] = React.useState(String((_a = state.keys) != null ? _a : ""));
    const [model, setModel] = React.useState(String((_b = state.model) != null ? _b : ""));
    const [savedAt, setSavedAt] = React.useState(0);
    const keyTimer = React.useRef(null);
    const modelTimer = React.useRef(null);
    const latestKeys = React.useRef(String((_c = state.keys) != null ? _c : ""));
    const latestModel = React.useRef(String((_d = state.model) != null ? _d : ""));
    const toggle = (name) => {
      const next = !state[name];
      writeSettings({ [name]: next });
      setState({ ...state, [name]: next });
    };
    const cleanKeys = (raw) => raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join("\n");
    const persistKeys = (raw) => {
      writeSettings({ keys: cleanKeys(raw) });
      setSavedAt(Date.now());
    };
    const persistModel = (raw) => {
      writeSettings({ model: raw.trim() });
      setSavedAt(Date.now());
    };
    const onChangeKeys = (text) => {
      latestKeys.current = text;
      setKeys(text);
      if (keyTimer.current) clearTimeout(keyTimer.current);
      keyTimer.current = setTimeout(() => persistKeys(text), 700);
    };
    const onChangeModel = (text) => {
      latestModel.current = text;
      setModel(text);
      if (modelTimer.current) clearTimeout(modelTimer.current);
      modelTimer.current = setTimeout(() => persistModel(text), 700);
    };
    const saveKeys = () => {
      if (keyTimer.current) clearTimeout(keyTimer.current);
      const value = cleanKeys(latestKeys.current);
      latestKeys.current = value;
      setKeys(value);
      writeSettings({ keys: value });
      setState({ ...state, keys: value });
      setSavedAt(Date.now());
    };
    const saveModel = () => {
      if (modelTimer.current) clearTimeout(modelTimer.current);
      const value = latestModel.current.trim();
      latestModel.current = value;
      setModel(value);
      writeSettings({ model: value });
      setState({ ...state, model: value });
      setSavedAt(Date.now());
    };
    const saved = parseKeys(keys).length;
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
        style: [styles.input, config.multiline ? styles.multiline : null],
        value: config.value,
        placeholder: config.placeholder,
        placeholderTextColor: "#6b6f76",
        autoCapitalize: "none",
        autoCorrect: false,
        multiline: Boolean(config.multiline),
        onChangeText: config.onChange,
        onBlur: config.onBlur,
        onSubmitEditing: config.multiline ? void 0 : config.onBlur
      }),
      config.hint ? React.createElement(RN.Text, { style: styles.hint }, config.hint) : null
    );
    return React.createElement(
      RN.ScrollView,
      { style: styles.screen, contentContainerStyle: styles.content },
      React.createElement(RN.Text, { style: styles.section }, "commands"),
      row("meme", "/meme", "any template, top and bottom text, or a random one"),
      row("memetext", "/memetext", "writes on the last picture posted in the channel"),
      row("random", "/random", "posts a random meme"),
      row("ask", "/ask", "asks gemini a question"),
      row("rewrite", "/r", "fixes grammar and wording"),
      row("shakespeare", "/shakespeare", "rewrites your line like shakespeare"),
      React.createElement(RN.Text, { style: styles.section }, "gemini"),
      field({
        label: "api keys",
        value: keys,
        placeholder: "one key per line",
        onChange: onChangeKeys,
        onBlur: saveKeys,
        multiline: true,
        hint: saved ? `${saved} key${saved === 1 ? "" : "s"} in the box, saved as you type. each one gets a turn until somebody answers` : "paste one or more keys, one per line"
      }),
      React.createElement(
        RN.Pressable,
        { onPress: saveKeys, style: styles.button },
        React.createElement(RN.Text, { style: styles.buttonText }, "save keys")
      ),
      field({
        label: "model",
        value: model,
        placeholder: "gemini-2.5-flash",
        onChange: onChangeModel,
        onBlur: saveModel,
        hint: "blank lets the plugin ask your key which models it has and pick a flash one"
      }),
      savedAt ? React.createElement(RN.Text, { style: styles.hint }, "saved. go back and run a command, no restart needed.") : null,
      React.createElement(
        RN.Text,
        { style: styles.note },
        "free keys from aistudio.google.com/apikey. keys stay in this plugin storage on your phone and only go to google."
      ),
      React.createElement(
        RN.Text,
        { style: styles.note },
        "google hands out the free tier per project, not per key. keys made under the same project all share the same 20 requests a day, so make extra keys on another google account."
      ),
      React.createElement(
        RN.Text,
        { style: styles.note },
        "when a model runs out the plugin moves to the next model on that same key, lite and 2.0 included, then to the next key. you only see an error when the whole stack is empty."
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
    multiline: { minHeight: 96, textAlignVertical: "top" },
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
  var Base2 = "https://api.memegen.link/images";
  function memeUrl(template, top, bottom) {
    const name = cleanTemplate(template) || randomTemplate();
    const segments = [];
    if (top) segments.push(encode(top));
    else if (bottom) segments.push("_");
    if (bottom) segments.push(encode(bottom));
    const path = segments.length ? `/${segments.join("/")}` : "";
    return `${Base2}/${name}${path}.png?width=600&font=impact`;
  }
  function customUrl(background, top, bottom) {
    const query = `background=${encodeURIComponent(background)}&width=600&font=impact`;
    return `${Base2}/custom/${top ? encode(top) : "_"}/${bottom ? encode(bottom) : "_"}.png?${query}`;
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
          const keys = readKeys();
          toast(keys.length > 1 ? `meme maker: asking gemini (${keys.length} keys)` : "meme maker: asking gemini");
          const answer = await generate(config.build(text), {
            keys,
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
      description: "ask gemini anything",
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