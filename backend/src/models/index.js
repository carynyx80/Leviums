import fs from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as rugscan from "./rugscan.js";
import * as walletscan from "./walletscan.js";

const modules = [
  { mod: rugscan, file: "./rugscan.js" },
  { mod: walletscan, file: "./walletscan.js" },
];

export const models = new Map();
for (const { mod, file } of modules) {
  const src = fs.readFileSync(fileURLToPath(new URL(file, import.meta.url)));
  const fingerprint = "0x" + createHash("sha256").update(src).digest("hex");
  models.set(mod.meta.id, { ...mod, fingerprint });
}

export function listModels() {
  return [...models.values()].map((m) => ({ ...m.meta, fingerprint: m.fingerprint }));
}
