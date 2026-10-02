import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../queue.db");

export const db = new Database(DB_PATH);
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