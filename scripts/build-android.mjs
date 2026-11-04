import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { verifyApkMedia } from "./media-assets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tools = process.env.FRASI_ANDROID_TOOLS || "/workspace/android-tools";
const env = { ...process.env };
if (!env.JAVA_HOME && existsSync(join(tools, "jdk/bin/javac")))
  env.JAVA_HOME = join(tools, "jdk");
if (!env.ANDROID_HOME && existsSync(join(tools, "sdk")))
  env.ANDROID_HOME = join(tools, "sdk");
env.ANDROID_HOME ||= env.ANDROID_SDK_ROOT;
if (
  !env.JAVA_HOME ||
  !existsSync(join(env.JAVA_HOME, "bin/javac")) ||
  !env.ANDROID_HOME
) {
  throw new Error(
    "Install JDK 21 and Android SDK 36, and set JAVA_HOME and ANDROID_HOME. See docs/ANDROID.md.",
  );
}
const managed = existsSync("/etc/codex/network-policy.json");
const args = ["--no-daemon", "--max-workers=2", "--console=plain"];
if (managed) {
  env.GRADLE_USER_HOME ||= join(tools, "gradle");
  env.ANDROID_USER_HOME ||= join(tools, "user");
  const javaHome = join(tools, "java-home");
  mkdirSync(javaHome, { recursive: true });
  args.push(`-Duser.home=${javaHome}`);
  const policy = JSON.parse(
    readFileSync("/etc/codex/network-policy.json", "utf8"),
  );
  if (policy.http_proxy) {
    const proxy = new URL(policy.http_proxy);
    if (proxy.username || proxy.password)
      throw new Error(
        "Use managed proxy credentials through the configured runtime.",
      );
    for (const protocol of ["http", "https"])
      args.push(
        `-D${protocol}.proxyHost=${proxy.hostname}`,
        `-D${protocol}.proxyPort=${proxy.port || 80}`,
      );
    args.push("-Dhttp.nonProxyHosts=localhost|127.*|[::1]");
  }
  if (existsSync("/etc/ssl/certs/java/cacerts"))
    args.push("-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts");
}
// The wrapper runs before Gradle parses its arguments and needs the same trust/proxy settings.
env.GRADLE_OPTS = [
  env.GRADLE_OPTS || "",
  ...args.filter((arg) => arg.startsWith("-D")),
].join(" ");
function run(command, commandArgs, cwd = root) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run("npm", ["run", "build"]);
run("npx", ["cap", "sync", "android"]);
run(
  process.platform === "win32" ? "gradlew.bat" : "./gradlew",
  [...args, "assembleDebug", "lintDebug"],
  join(root, "android"),
);
const output = join(root, "artifacts");
mkdirSync(output, { recursive: true });
const version = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
).version;
const apk = join(output, `frasi-${version}-android.apk`);
const mediaAudit = verifyApkMedia(
  root,
  join(root, "android/app/build/outputs/apk/debug/app-debug.apk"),
  env.JAVA_HOME,
);
copyFileSync(
  join(root, "android/app/build/outputs/apk/debug/app-debug.apk"),
  apk,
);
run(join(env.ANDROID_HOME, "build-tools/36.0.0/apksigner"), [
  "verify",
  "--verbose",
  apk,
]);
const sha = createHash("sha256").update(readFileSync(apk)).digest("hex");
writeFileSync(apk + ".sha256", `${sha}  frasi-${version}-android.apk\n`);
writeFileSync(
  join(output, `frasi-${version}-media-audit.json`),
  JSON.stringify({ version, sha256: sha, ...mediaAudit }, null, 2) + "\n",
);
console.log(`APK: ${apk}\nSHA-256: ${sha}`);
