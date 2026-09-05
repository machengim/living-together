CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  speaker TEXT NOT NULL CHECK (speaker IN ('user', 'assistant')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content TEXT NOT NULL CHECK (length(btrim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx
  ON chat_messages (created_at, id);
