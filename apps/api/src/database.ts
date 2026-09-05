import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { ChatMessage } from "./providers/ai-provider.js";

const { Pool } = pg;
const migrationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations/001_create_chat_messages.sql",
);

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://living_together:living_together_dev@localhost:5432/living_together",
});

export async function initializeDatabase() {
  const migrationsDirectory = dirname(migrationPath);
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((fileName) => /^\d+_.*\.sql$/.test(fileName))
    .sort();

  for (const migrationFile of migrationFiles) {
    const migration = await readFile(resolve(migrationsDirectory, migrationFile), "utf8");
    await pool.query(migration);
  }
}

export async function getActiveAiProvider() {
  const result = await pool.query<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'active_ai_provider'",
  );

  return result.rows[0]?.value || "ollama";
}

export async function setActiveAiProvider(provider: string) {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('active_ai_provider', $1, now())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = now()`,
    [provider],
  );
}

export async function getRecentMessages(limit: number): Promise<ChatMessage[]> {
  const result = await pool.query<{
    speaker: ChatMessage["role"];
    content: string;
  }>(
    `SELECT speaker, content
     FROM chat_messages
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.reverse().map((row) => ({
    role: row.speaker,
    content: row.content,
  }));
}

export async function saveMessage(message: ChatMessage) {
  await pool.query(
    `INSERT INTO chat_messages (speaker, content)
     VALUES ($1, $2)`,
    [message.role, message.content],
  );
}

export async function clearChatHistory() {
  await pool.query("DELETE FROM chat_messages");
}
