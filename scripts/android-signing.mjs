import { spawnSync } from "node:child_process";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expected = JSON.parse(
  readFileSync(join(root, "android/signing-certificate.json"), "utf8"),
).certificateSha256;
const kdf = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

export function signingPaths(env = process.env) {
  const tools = env.FRASI_ANDROID_TOOLS || "/workspace/android-tools";
  return {
    key: env.FRASI_ANDROID_KEYSTORE || join(tools, "signing/frasi.keystore"),
    java: env.JAVA_HOME || join(tools, "jdk"),
    backup: join(root, "android/signing-key.backup.json"),
  };
}

export function certificateSha256(key, java) {
  const result = spawnSync(join(java, "bin/keytool"), [
    "-exportcert",
    "-keystore",
    key,
    "-storepass",
    "android",
    "-alias",
    "AndroidDebugKey",
  ]);
  if (result.error || result.status !== 0)
    throw new Error("Cannot read the Android signing certificate.");
  return createHash("sha256").update(result.stdout).digest("hex");
}

export function assertSigningKey(env = process.env) {
  const paths = signingPaths(env);
  if (!existsSync(paths.key))
    throw new Error(
      "Android signing key is missing. Build stopped before Gradle can generate a replacement. Restore it with npm run android:key:restore; see docs/SIGNING.md.",
    );
  const actual = certificateSha256(paths.key, paths.java);
  if (actual !== expected)
    throw new Error(
      "Android signing certificate changed. Build stopped to protect installed progress. Restore the original key; see docs/SIGNING.md.",
    );
  return actual;
}

export function encryptSigningBackup(bytes, passphrase) {
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32, kdf);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    kdf: "scrypt-65536-8-1",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    encrypted: encrypted.toString("base64"),
  };
}

function decryptSigningBackup(backup, passphrase) {
  if (
    backup.version !== 1 ||
    backup.algorithm !== "aes-256-gcm" ||
    backup.kdf !== "scrypt-65536-8-1"
  )
    throw new Error("Unsupported signing backup format.");
  const key = scryptSync(
    passphrase,
    Buffer.from(backup.salt, "base64"),
    32,
    kdf,
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(backup.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(backup.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(backup.encrypted, "base64")),
    decipher.final(),
  ]);
}

export function restoreSigningKey(env = process.env) {
  const paths = signingPaths(env);
  if (existsSync(paths.key)) {
    assertSigningKey(env);
    return; // Never overwrite an existing key.
  }
  const passphraseFile = env.FRASI_SIGNING_BACKUP_PASSPHRASE_FILE;
  const passphrase = passphraseFile
    ? readFileSync(passphraseFile, "utf8").trim()
    : env.FRASI_SIGNING_BACKUP_PASSPHRASE;
  if (!passphrase)
    throw new Error(
      "Set FRASI_SIGNING_BACKUP_PASSPHRASE_FILE to your private recovery file. Never put it in Git or chat. See docs/SIGNING.md.",
    );
  let bytes;
  try {
    bytes = decryptSigningBackup(
      JSON.parse(readFileSync(paths.backup, "utf8")),
      passphrase,
    );
  } catch {
    throw new Error(
      "Signing backup could not be decrypted. Key was not created or replaced.",
    );
  }
  mkdirSync(dirname(paths.key), { recursive: true, mode: 0o700 });
  const temporary = `${paths.key}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    writeFileSync(temporary, bytes, { mode: 0o600, flag: "wx" });
    if (certificateSha256(temporary, paths.java) !== expected)
      throw new Error("Restored signing certificate does not match.");
    linkSync(temporary, paths.key); // Atomic publication without replacing an existing key.
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv[2] === "restore") restoreSigningKey();
    console.log(`Signing certificate verified: ${assertSigningKey()}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
