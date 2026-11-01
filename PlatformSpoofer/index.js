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

  // src/PlatformSpoofer/index.ts
  var index_exports = {};
  __export(index_exports, {
    default: () => index_default
  });

  // src/PlatformSpoofer/shared.ts
  var DefaultSettings = {
    enabled: true,
    preset: "desktop"
  };
  var Profiles = {
    desktop: {
      $os: "Windows",
      $os_version: "10.0.19045",
      $browser: "Discord Client",
      $browser_version: "",
      $device: "",
      $release_channel: "stable",
      $system_locale: "en-US"
    },
    web: {
      $os: "Windows",
      $os_version: "10.0.19045",
      $browser: "Chrome",
      $browser_version: "131.0.0.0",
      $device: "",
      $release_channel: "stable",
      $system_locale: "en-US"
    }
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
  function readProfile() {
    var _a;
    const { enabled, preset } = readSettings();
    if (!enabled) return void 0;
    return (_a = Profiles[preset]) != null ? _a : Profiles.desktop;
  }

  // src/PlatformSpoofer/identify.ts
  var IdentifyOp = /"op"\s*:\s*2\b/;
  var announced = false;
  function rewriteIdentify(json, profile) {
    var _a;
    if (!profile || typeof json !== "string") return;
    if (!json.includes('"properties"') || !IdentifyOp.test(json)) return;
    let payload;
    try {
      payload = JSON.parse(json);
    } catch {
      return;
    }
    if ((payload == null ? void 0 : payload.op) !== 2 || !((_a = payload.d) == null ? void 0 : _a.properties)) return;
    Object.assign(payload.d.properties, profile);
    return JSON.stringify(payload);
  }
  function hookGateway() {
    var _a;
    const patcher = vendetta == null ? void 0 : vendetta.patcher;
    if (!patcher) {
      console.log("[platform-spoofer] no patcher on this build");
      return () => {
      };
    }
    const WS = globalThis.WebSocket;
    if (!((_a = WS == null ? void 0 : WS.prototype) == null ? void 0 : _a.send)) {
      console.log("[platform-spoofer] no WebSocket.send here, nothing to hook");
      return () => {
      };
    }
    const dispose2 = patcher.before("send", WS.prototype, (args) => {
      const next = rewriteIdentify(args[0], readProfile());
      if (!next) return;
      return [next, ...args.slice(1)];
    });
    if (!announced) {
      announced = true;
      console.log("[platform-spoofer] hooked the gateway socket, reconnect to apply");
    }
    return dispose2;
  }

  // src/PlatformSpoofer/settings.ts
  var Presets = [
    { value: "desktop", label: "Desktop" },
    { value: "web", label: "Browser" }
  ];
  function SettingsScreen() {
    const React = vendetta.metro.common.React;
    const RN = vendetta.metro.common.ReactNative;
    const [state, setState] = React.useState(() => readSettings());
    const update = (patch) => {
      writeSettings(patch);
      setState({ ...state, ...patch });
    };
    const presetButton = ({ value, label }) => {
      const active = state.preset === value;
      return React.createElement(
        RN.Pressable,
        {
          key: value,
          style: [styles.pill, active && styles.pillActive],
          onPress: () => update({ preset: value })
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
      React.createElement(
        RN.View,
        { style: styles.row },
        React.createElement(
          RN.View,
          { style: styles.texts },
          React.createElement(RN.Text, { style: styles.label }, "Show me as desktop"),
          React.createElement(
            RN.Text,
            { style: styles.sub },
            "everyone sees the desktop icon, including people on stock discord"
          )
        ),
        React.createElement(RN.Switch, {
          value: state.enabled,
          onValueChange: (enabled) => update({ enabled })
        })
      ),
      React.createElement(
        RN.View,
        { style: styles.row },
        React.createElement(
          RN.View,
          { style: styles.texts },
          React.createElement(RN.Text, { style: styles.label }, "Pretend to be"),
          React.createElement(
            RN.Text,
            { style: styles.sub },
            "desktop app or a browser tab, both look the same to other people"
          )
        ),
        React.createElement(RN.View, { style: styles.pills }, Presets.map(presetButton))
      ),
      React.createElement(
        RN.Text,
        { style: styles.note },
        "restart discord after flipping this. the phone only says which platform it is when the gateway connects, so the change lands on the next connect."
      ),
      React.createElement(
        RN.Text,
        { style: styles.note },
        "notifications keep working, they go through push, not the gateway."
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
    note: { color: "#7f8489", fontSize: 12, marginTop: 12, lineHeight: 17 },
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

  // src/PlatformSpoofer/index.ts
  var dispose;
  var index_default = {
    onLoad() {
      dispose = hookGateway();
    },
    onUnload() {
      dispose == null ? void 0 : dispose();
      dispose = void 0;
    },
    settings: SettingsScreen
  };
  return __toCommonJS(index_exports);
})();

return plugin && (plugin.default || plugin)
})()