-- AI City schema. Idempotent: safe to run on every deploy.
--
-- Two layers. A pop-up city (`cities`) is a place and a time window run by a core team; it holds
-- no money and lives only here. A residency (`residencies`) is one house, its beds and its own
-- onchain Residency contract, always inside one city. Residencies are proposed into a city and
-- approved by its core team before they are deployed (`residency_proposals`). A residency series
-- (`residency_series`) links the instances of a residency that recurs.

-- One-time upgrade of a pre-city-layer database, where `cities` held what are now residencies.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'cities' AND column_name = 'metadata_json') THEN
    ALTER TABLE cities RENAME TO residencies;
    ALTER INDEX IF EXISTS cities_end_time_idx RENAME TO residencies_end_time_idx;
    ALTER INDEX IF EXISTS cities_created_at_idx RENAME TO residencies_created_at_idx;
    ALTER TABLE applications RENAME COLUMN city TO residency;
    ALTER TABLE receipts RENAME COLUMN city TO residency;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  address            TEXT PRIMARY KEY,                -- lowercase 0x address
  nullifier          NUMERIC(78, 0) UNIQUE,           -- World ID nullifier: one wallet per human
  verified_at        TIMESTAMPTZ,
  adult_attested_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Directory profiles. Public unless `listed` is false (the opt-out).
CREATE TABLE IF NOT EXISTS profiles (
  address     TEXT PRIMARY KEY REFERENCES users(address),
  name        TEXT NOT NULL,
  bio         TEXT NOT NULL DEFAULT '',
  links       JSONB NOT NULL DEFAULT '[]',
  photo       BYTEA,
  photo_mime  TEXT,
  listed      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pop-up cities: offchain containers for residencies.
CREATE TABLE IF NOT EXISTS cities (
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,                 -- immutable; residency metadata pins it
  name         TEXT NOT NULL,
  location     TEXT NOT NULL,
  mission      TEXT NOT NULL,
  description  TEXT NOT NULL,
  start_time   BIGINT NOT NULL,
  end_time     BIGINT NOT NULL,
  founder      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cities_end_time_idx ON cities (end_time);

CREATE TABLE IF NOT EXISTS city_core_team (
  city_id   BIGINT NOT NULL REFERENCES cities(id),
  address   TEXT NOT NULL,
  role      TEXT NOT NULL CHECK (role IN ('founder', 'core')),
  added_by  TEXT NOT NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (city_id, address)
);

-- A residency that recurs (e.g. once or twice a year), possibly in different cities.
CREATE TABLE IF NOT EXISTS residency_series (
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  owner        TEXT NOT NULL,                        -- only the owner proposes new instances
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A residency proposed into a city. Approved proposals are deployed by the proposer.
CREATE TABLE IF NOT EXISTS residency_proposals (
  id             BIGSERIAL PRIMARY KEY,
  city_id        BIGINT NOT NULL REFERENCES cities(id),
  series_id      BIGINT NOT NULL REFERENCES residency_series(id),
  proposer       TEXT NOT NULL,
  metadata_json  TEXT NOT NULL,                      -- canonical JSON the contract will pin
  metadata_hash  TEXT NOT NULL,
  start_time     BIGINT NOT NULL,
  end_time       BIGINT NOT NULL,
  deadline       BIGINT NOT NULL,
  min_seats      INT NOT NULL,
  max_seats      INT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'proposed'
                   CHECK (status IN ('proposed', 'approved', 'rejected', 'deployed')),
  reviewed_by    TEXT,
  review_note    TEXT,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS residency_proposals_city_idx ON residency_proposals (city_id, status);

-- Deployed residencies: one Residency contract each.
CREATE TABLE IF NOT EXISTS residencies (
  address        TEXT PRIMARY KEY,
  host           TEXT NOT NULL,
  metadata_json  TEXT NOT NULL,                      -- canonical JSON, exactly what was hashed
  metadata_hash  TEXT NOT NULL,
  start_time     BIGINT NOT NULL,
  end_time       BIGINT NOT NULL,
  deadline       BIGINT NOT NULL,
  min_seats      INT NOT NULL,
  max_seats      INT NOT NULL,
  created_tx     TEXT NOT NULL,
  created_block  BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE residencies ADD COLUMN IF NOT EXISTS city_id BIGINT REFERENCES cities(id);   -- NULL only for pre-city rows
ALTER TABLE residencies ADD COLUMN IF NOT EXISTS series_id BIGINT REFERENCES residency_series(id);
ALTER TABLE residencies ADD COLUMN IF NOT EXISTS proposal_id BIGINT UNIQUE REFERENCES residency_proposals(id);
ALTER TABLE residencies ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE residencies ADD COLUMN IF NOT EXISTS hidden_note TEXT;
CREATE INDEX IF NOT EXISTS residencies_end_time_idx ON residencies (end_time);
CREATE INDEX IF NOT EXISTS residencies_created_at_idx ON residencies (created_at DESC);
CREATE INDEX IF NOT EXISTS residencies_city_idx ON residencies (city_id);

CREATE TABLE IF NOT EXISTS applications (
  id             BIGSERIAL PRIMARY KEY,
  residency      TEXT NOT NULL REFERENCES residencies(address),
  applicant      TEXT NOT NULL,
  name           TEXT NOT NULL,
  bio            TEXT NOT NULL,
  links          JSONB NOT NULL DEFAULT '[]',
  preferred_bed  INT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  bed_id         INT,
  price_units    TEXT,
  decision_tx    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (residency, applicant)
);

CREATE TABLE IF NOT EXISTS receipts (
  id            BIGSERIAL PRIMARY KEY,
  residency     TEXT NOT NULL REFERENCES residencies(address),
  tx_hash       TEXT NOT NULL UNIQUE,
  receipt_hash  TEXT NOT NULL,
  filename      TEXT NOT NULL,
  mime          TEXT NOT NULL,
  data          BYTEA NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Knowledge bases behind each city's and residency's concierge. `content` is the file's text:
-- markdown as written, or text extracted from an uploaded PDF/DOCX (the original kept in
-- `source`). A city's files are edited by its founder, a residency's by its host.
-- `shared` holds platform-wide files (scope_key = folder name, e.g. 'argo-journal').
CREATE TABLE IF NOT EXISTS knowledge_files (
  id          BIGSERIAL PRIMARY KEY,
  scope       TEXT NOT NULL CHECK (scope IN ('city', 'residency', 'shared')),
  scope_key   TEXT NOT NULL,                         -- city slug, lowercase residency address, or folder
  filename    TEXT NOT NULL,
  mime        TEXT NOT NULL,                         -- of the original file
  content     TEXT NOT NULL,
  source      BYTEA,                                 -- original upload when it isn't plain text
  updated_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope, scope_key, filename)
);

-- Search and retrieval work on chunks: paragraphs packed up to ~1500 characters.
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  file_id  BIGINT NOT NULL REFERENCES knowledge_files(id) ON DELETE CASCADE,
  idx      INT NOT NULL,
  content  TEXT NOT NULL,
  search   TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  PRIMARY KEY (file_id, idx)
);
CREATE INDEX IF NOT EXISTS knowledge_chunks_search_idx ON knowledge_chunks USING gin (search);

-- Rebuilds a file's chunks whenever its text changes, so they can never drift from `content`.
CREATE OR REPLACE FUNCTION knowledge_rechunk() RETURNS trigger AS $$
DECLARE
  max_len CONSTANT INT := 1500;
  para TEXT;
  buf TEXT := '';
  n INT := 0;
BEGIN
  DELETE FROM knowledge_chunks WHERE file_id = NEW.id;
  FOR para IN SELECT btrim(p) FROM regexp_split_to_table(NEW.content, E'\\n\\s*\\n') AS p LOOP
    CONTINUE WHEN para = '';
    IF buf <> '' AND length(buf) + length(para) + 2 > max_len THEN
      INSERT INTO knowledge_chunks (file_id, idx, content) VALUES (NEW.id, n, buf);
      n := n + 1;
      buf := '';
    END IF;
    -- A paragraph longer than a chunk (common in extracted PDFs) is cut into pieces.
    WHILE length(para) > max_len LOOP
      INSERT INTO knowledge_chunks (file_id, idx, content) VALUES (NEW.id, n, left(para, max_len));
      n := n + 1;
      para := substr(para, max_len + 1);
    END LOOP;
    buf := CASE WHEN buf = '' THEN para ELSE buf || E'\n\n' || para END;
  END LOOP;
  IF buf <> '' THEN
    INSERT INTO knowledge_chunks (file_id, idx, content) VALUES (NEW.id, n, buf);
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql
-- Pinned so the trigger also works under pg_dump/pg_restore, which empty the search_path.
SET search_path FROM CURRENT;

DROP TRIGGER IF EXISTS knowledge_files_rechunk ON knowledge_files;
CREATE TRIGGER knowledge_files_rechunk AFTER INSERT OR UPDATE OF content ON knowledge_files
  FOR EACH ROW EXECUTE FUNCTION knowledge_rechunk();

-- Agent API keys. A key acts as its wallet over `Authorization: Bearer aic_…`, like the session
-- cookie. Only the sha256 of the key is stored; the key itself is shown once, at creation.
-- Keys are created and revoked with the cookie session only, so a leaked key can't mint more.
CREATE TABLE IF NOT EXISTS api_keys (
  id            BIGSERIAL PRIMARY KEY,
  address       TEXT NOT NULL,                       -- lowercase 0x address the key acts as
  name          TEXT NOT NULL,
  prefix        TEXT NOT NULL,                       -- first characters, to tell keys apart in the UI
  key_hash      TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS api_keys_address_idx ON api_keys (address);
