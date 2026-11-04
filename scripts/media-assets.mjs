import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  readFileSync,
  readdirSync,
  mkdtempSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

export function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}
const sha256 = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const clipsAt = (root) =>
  Object.values(
    JSON.parse(readFileSync(join(root, "src/data/audio-clips.json"), "utf8")),
  );

export function verifyPublicMedia(root) {
  const clips = clipsAt(root);
  const permittedAudio = new Set(clips.map((clip) => `audio/${clip.file}`));
  const publicRoot = join(root, "public");
  const files = filesUnder(publicRoot);
  for (const path of files) {
    const name = relative(publicRoot, path).replaceAll("\\", "/");
    const head = readFileSync(path).subarray(0, 1024);
    assert(
      !/\.pdf$/i.test(name) && !head.includes(Buffer.from("%PDF-")),
      `Original PDF must not be bundled: ${name}`,
    );
    assert(
      !name.startsWith("materials/"),
      `Source documents must stay outside public/: ${name}`,
    );
    const isAudio =
      /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name) ||
      head.subarray(0, 3).toString() === "ID3" ||
      (head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
    if (isAudio)
      assert(
        permittedAudio.has(name),
        `Only declared exercise clips may be bundled: ${name}`,
      );
  }
  for (const clip of clips) {
    assert(/^[a-z0-9-]+\.mp3$/.test(clip.file), "Invalid clip filename");
    assert(
      clip.startSeconds >= 0 &&
        clip.endSeconds > clip.startSeconds &&
        clip.endSeconds < clip.sourceDurationSeconds,
    );
    assert(
      clip.durationSeconds > 0 && clip.durationSeconds < 300,
      "Exercise audio must be a short excerpt",
    );
    assert(
      Math.abs(clip.durationSeconds - (clip.endSeconds - clip.startSeconds)) <
        0.15,
      "Incorrect clip duration",
    );
    assert(
      clip.sha256 !== clip.sourceSha256,
      "Full original recording cannot be an exercise clip",
    );
    const path = join(publicRoot, "audio", clip.file);
    assert.equal(
      statSync(path).size,
      clip.bytes,
      `Unexpected clip size: ${clip.file}`,
    );
    assert.equal(
      sha256(path),
      clip.sha256,
      `Exercise clip differs from its approved manifest: ${clip.file}`,
    );
  }
  return {
    pdfFiles: 0,
    audioClips: clips.length,
    publicBytes: files.reduce((total, path) => total + statSync(path).size, 0),
  };
}

export function verifyApkMedia(root, apk, javaHome) {
  const summary = verifyPublicMedia(root);
  const jar = join(
    javaHome,
    "bin",
    process.platform === "win32" ? "jar.exe" : "jar",
  );
  const entries = execFileSync(jar, ["tf", apk], {
    encoding: "utf8",
    maxBuffer: 10_000_000,
  })
    .trim()
    .split(/\r?\n/);
  assert(!entries.some((name) => /\.pdf$/i.test(name)), "APK contains a PDF");
  const expectedWeb = filesUnder(join(root, "dist"))
    .map(
      (path) =>
        `assets/public/${relative(join(root, "dist"), path).replaceAll("\\", "/")}`,
    )
    .concat(["assets/public/cordova.js", "assets/public/cordova_plugins.js"])
    .sort();
  const actualWeb = entries
    .filter((name) => name.startsWith("assets/public/") && !name.endsWith("/"))
    .sort();
  assert.deepEqual(
    actualWeb,
    expectedWeb,
    "APK contains stale or missing web assets",
  );
  const clips = clipsAt(root);
  const expectedAudio = clips
    .map((clip) => `assets/public/audio/${clip.file}`)
    .sort();
  assert.deepEqual(
    entries
      .filter((name) => /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name))
      .sort(),
    expectedAudio,
    "APK contains undeclared recordings",
  );
  const directory = mkdtempSync(join(tmpdir(), "frasi-apk-audio-"));
  try {
    execFileSync(jar, ["xf", apk, ...expectedAudio], { cwd: directory });
    for (const clip of clips)
      assert.equal(
        sha256(join(directory, "assets/public/audio", clip.file)),
        clip.sha256,
      );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  return { ...summary, clipHashesVerifiedInsideApk: true };
}
