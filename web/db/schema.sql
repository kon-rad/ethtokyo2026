-- AI City schema. Idempotent: safe to run on every deploy.

CREATE TABLE IF NOT EXISTS users (
  address            TEXT PRIMARY KEY,                -- lowercase 0x address
  nullifier          NUMERIC(78, 0) UNIQUE,           -- World ID nullifier: one wallet per human
  verified_at        TIMESTAMPTZ,
  adult_attested_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cities (
  address        TEXT PRIMARY KEY,
  host           TEXT NOT NULL,
  metadata_json  TEXT NOT NULL,                        -- canonical JSON, exactly what was hashed
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
CREATE INDEX IF NOT EXISTS cities_end_time_idx ON cities (end_time);
CREATE INDEX IF NOT EXISTS cities_created_at_idx ON cities (created_at DESC);

CREATE TABLE IF NOT EXISTS applications (
  id             BIGSERIAL PRIMARY KEY,
  city           TEXT NOT NULL REFERENCES cities(address),
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
  UNIQUE (city, applicant)
);

CREATE TABLE IF NOT EXISTS receipts (
  id            BIGSERIAL PRIMARY KEY,
  city          TEXT NOT NULL REFERENCES cities(address),
  tx_hash       TEXT NOT NULL UNIQUE,
  receipt_hash  TEXT NOT NULL,
  filename      TEXT NOT NULL,
  mime          TEXT NOT NULL,
  data          BYTEA NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
