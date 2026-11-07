import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSigningKey,
  restoreSigningKey,
  signingPaths,
} from "./android-signing.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = signingPaths();
const certificate = assertSigningKey();
const scratch = mkdtempSync(join(tmpdir(), "frasi-signing-test-"));
try {
  const restored = join(scratch, "restored/frasi.keystore");
  const env = { ...process.env, FRASI_ANDROID_KEYSTORE: restored };
  assert.throws(() => assertSigningKey(env), /key is missing/);
  assert.equal(existsSync(restored), false);
  restoreSigningKey(env);
  assert.equal(assertSigningKey(env), certificate);
  assert.deepEqual(readFileSync(restored), readFileSync(paths.key));
  if (process.platform !== "win32")
    assert.equal(statSync(restored).mode & 0o777, 0o600);
  restoreSigningKey(env);

  const wrongPassphrase = join(scratch, "wrong-passphrase.txt");
  writeFileSync(wrongPassphrase, "incorrect recovery value", { mode: 0o600 });
  const failedKey = join(scratch, "must-not-exist.keystore");
  assert.throws(
    () =>
      restoreSigningKey({
        ...env,
        FRASI_ANDROID_KEYSTORE: failedKey,
        FRASI_SIGNING_BACKUP_PASSPHRASE_FILE: wrongPassphrase,
      }),
    /could not be decrypted/,
  );
  assert.equal(existsSync(failedKey), false);

  const wrongKey = join(scratch, "wrong.keystore");
  const generated = spawnSync(join(paths.java, "bin/keytool"), [
    "-genkeypair",
    "-keystore",
    wrongKey,
    "-storepass",
    "android",
    "-keypass",
    "android",
    "-alias",
    "AndroidDebugKey",
    "-dname",
    "CN=Signing Guard Test",
    "-keyalg",
    "RSA",
    "-validity",
    "2",
  ]);
  if (generated.error) throw generated.error;
  assert.equal(generated.status, 0);
  const changed = { ...env, FRASI_ANDROID_KEYSTORE: wrongKey };
  assert.throws(() => assertSigningKey(changed), /certificate changed/);
  const before = readFileSync(wrongKey);
  assert.throws(() => restoreSigningKey(changed), /certificate changed/);
  assert.deepEqual(readFileSync(wrongKey), before);

  const stopped = spawnSync("node", ["scripts/build-android.mjs"], {
    cwd: root,
    env: {
      ...env,
      FRASI_ANDROID_KEYSTORE: join(scratch, "missing-build-key.keystore"),
    },
    encoding: "utf8",
  });
  if (stopped.error) throw stopped.error;
  assert.notEqual(stopped.status, 0);
  assert.match(stopped.stderr, /key is missing/);
  assert.doesNotMatch(stopped.stdout, /vite|assembleDebug/);
  console.log(
    "Signing recovery verified: exact key restored, private file permissions, safe repeat, wrong password rejected, changed certificate rejected, existing key preserved, missing key blocks build before Gradle.",
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
