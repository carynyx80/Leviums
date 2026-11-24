import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config.js";

const file = path.resolve(DATA_DIR, "receipts.json");
const receipts = new Map(); // insertion order = creation order

export function loadStore() {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) return 0;
    const arr = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Array.isArray(arr)) for (const r of arr) if (r && typeof r.id === "string") receipts.set(r.id.toLowerCase(), r);
  } catch (err) {
    console.error(`[store] failed to load ${file}: ${err.message}`);
  }
  return receipts.size;
}

let writing = Promise.resolve();
function persist() {
  const data = JSON.stringify([...receipts.values()], null, 0);
  writing = writing
    .then(async () => {
      const tmp = file + ".tmp";
      await fs.promises.mkdir(path.dirname(file), { recursive: true });
      await fs.promises.writeFile(tmp, data);
      await fs.promises.rename(tmp, file);
    })
    .catch((err) => console.error(`[store] persist failed: ${err.message}`));
  return writing;
}

export function saveReceipt(r) {
  receipts.set(r.id.toLowerCase(), r);
  persist();
  return r;
}
export const getReceipt = (id) => (typeof id === "string" ? receipts.get(id.toLowerCase()) || null : null);
export function feed(limit) {
  return [...receipts.values()].reverse().slice(0, limit);
}
export function stats() {
  let anchored = 0;
  const models = {};
  for (const r of receipts.values()) {
    if (r.anchor) anchored++;
    models[r.model] = (models[r.model] || 0) + 1;
  }
  return { totalReceipts: receipts.size, anchored, models };
}
