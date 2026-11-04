import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { verifyPublicMedia } from "./media-assets.mjs";
console.log(
  "Bundled media:",
  verifyPublicMedia(resolve(dirname(fileURLToPath(import.meta.url)), "..")),
);
