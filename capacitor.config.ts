import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zakgovin.greekphraseapp",
  appName: "Φράση",
  webDir: "dist",
  backgroundColor: "#f6f7f2",
  server: { errorPath: "webview-error.html" },
  android: {
    backgroundColor: "#f6f7f2",
    allowMixedContent: false,
    minWebViewVersion: 94,
  },
};

export default config;
