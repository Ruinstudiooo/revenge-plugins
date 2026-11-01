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

  // src/GhostPing/index.ts
  var index_exports = {};
  __export(index_exports, {
    default: () => index_default
  });

  // src/GhostPing/shared.ts
  var DefaultSettings = {
    enabled: true,
    everyone: true,
    maxAge: 15,
    ignoreBots: true
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
  }

  // src/GhostPing/settings.ts
  var Ages = [
    { value: 5, label: "5m" },
    { value: 15, label: "15m" },
    { value: 60, label: "1h" },
    { value: 0, label: "any" }
  ];
  function SettingsScreen() {
    const React = vendetta.metro.common.React;
    const RN = vendetta.metro.common.ReactNative;
    const [state, setState] = React.useState(() => readSettings());
    const update = (patch) => {
      writeSettings(patch);
      setState({ ...state, ...patch });
    };
    const switchRow = (key, label, sub) => React.createElement(
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
    const ageButton = ({ value, label }) => {
      const active = state.maxAge === value;
      return React.createElement(
        RN.Pressable,
        {
          key: value,
          style: [styles.pill, active && styles.pillActive],
          onPress: () => update({ maxAge: value })
        },
        React.createElement(
          RN.Text,
          { style: [styles.pillText, active && styles.pillTextActive] },
          label
        )
      );
    };
    return React.createElement(
      RN.ScrollView,
      { style: styles.screen, contentContainerStyle: styles.content },
      switchRow("enabled", "Ghost ping alerts", "toast me when a message that pinged me gets deleted"),
      switchRow("everyone", "@everyone and @here", "also count mass pings, not just my own mentions"),
      switchRow("ignoreBots", "Ignore bots", "bots edit and delete their own messages all the time"),
      React.createElement(
        RN.View,
        { style: styles.row },
        React.createElement(
          RN.View,
          { style: styles.texts },
          React.createElement(RN.Text, { style: styles.label }, "How late is still a ghost ping"),
          React.createElement(RN.Text, { style: styles.sub }, "deletes older than this get ignored")
        ),
        React.createElement(RN.View, { style: styles.pills }, Ages.map(ageButton))
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
    pills: { flexDirection: "row", gap: 6 },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: "#2b2d31"
    },
    pillActive: { backgroundColor: "#5865f2" },
    pillText: { color: "#b5bac1", fontSize: 13 },
    pillTextActive: { color: "#ffffff", fontWeight: "600" }
  };

  // src/GhostPing/index.ts
  var recent = /* @__PURE__ */ new Map();
  var MaxRecent = 200;
  var dispose;
  var myId;
  var askedForId = false;
  function whoAmI() {
    var _a, _b;
    if (askedForId) return myId;
    askedForId = true;
    try {
      myId = (_b = (_a = vendetta.metro.findByStoreName("UserStore")) == null ? void 0 : _a.getCurrentUser()) == null ? void 0 : _b.id;
    } catch {
      myId = void 0;
    }
    return myId;
  }
  function remember(message) {
    if (!(message == null ? void 0 : message.id)) return;
    recent.set(message.id, message);
    if (recent.size <= MaxRecent) return;
    const oldest = recent.keys().next().value;
    if (oldest) recent.delete(oldest);
  }
  function pingedUs(record, everyone, id) {
    var _a;
    if (id && ((_a = record.mentions) == null ? void 0 : _a.some((user) => user.id === id))) return true;
    return everyone && record.mention_everyone === true;
  }
  function tooOld(record, maxAge) {
    if (!maxAge || !record.timestamp) return false;
    const sent = Date.parse(record.timestamp);
    if (!Number.isFinite(sent)) return false;
    return Date.now() - sent > maxAge * 6e4;
  }
  function preview(record) {
    var _a;
    const text = ((_a = record.content) != null ? _a : "").replace(/\s+/g, " ").trim();
    if (!text) return "attachment only";
    return text.length > 70 ? `${text.slice(0, 70)}...` : text;
  }
  function nameOf(record) {
    var _a, _b, _c, _d;
    return (_d = (_c = (_a = record.author) == null ? void 0 : _a.globalName) != null ? _c : (_b = record.author) == null ? void 0 : _b.username) != null ? _d : "someone";
  }
  function toast(text) {
    try {
      vendetta.ui.toasts.showToast(text);
    } catch {
      console.log(`[ghost-ping] ${text}`);
    }
  }
  function onDelete(payload) {
    var _a, _b;
    const settings = readSettings();
    if (!settings.enabled || !(payload == null ? void 0 : payload.id)) return;
    const record = recent.get(payload.id);
    recent.delete(payload.id);
    if (!record) return;
    const id = whoAmI();
    if (id && ((_a = record.author) == null ? void 0 : _a.id) === id) return;
    if (settings.ignoreBots && ((_b = record.author) == null ? void 0 : _b.bot)) return;
    if (tooOld(record, settings.maxAge)) return;
    if (!pingedUs(record, settings.everyone, id)) return;
    toast(`ghost ping from ${nameOf(record)}: ${preview(record)}`);
  }
  var index_default = {
    onLoad() {
      const Flux = vendetta.metro.common.FluxDispatcher;
      dispose = vendetta.patcher.before("dispatch", Flux, (args) => {
        const payload = args[0];
        try {
          if ((payload == null ? void 0 : payload.type) === "MESSAGE_CREATE" && payload.message) {
            remember(payload.message);
          } else if ((payload == null ? void 0 : payload.type) === "MESSAGE_DELETE") {
            onDelete(payload);
          }
        } catch (error) {
          console.log("[ghost-ping] dispatch blew up", error);
        }
      });
    },
    onUnload() {
      dispose == null ? void 0 : dispose();
      dispose = void 0;
      recent.clear();
    },
    settings: SettingsScreen
  };
  return __toCommonJS(index_exports);
})();

return plugin && (plugin.default || plugin)
})()