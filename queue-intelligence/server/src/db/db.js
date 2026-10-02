import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../queue.db");

export const db = new DatabaseSync(DB_PATH);
db.pragma = (str) => db.exec(`PRAGMA ${str}`);
db.transaction = (fn) => {
  return (...args) => {
    db.exec("BEGIN");
    try {
      const res = fn(...args);
      db.exec("COMMIT");
      return res;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
};

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(sql);
}

export function dropAll() {
  db.pragma("foreign_keys = OFF");
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
    .all();
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS ${t.name}`);
  db.pragma("foreign_keys = ON");
}