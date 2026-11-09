-- Run this once in the Supabase SQL Editor. Safe to rerun: existing data is kept.
-- The private schema is accessed only by the server, not Supabase's public API.
BEGIN;
CREATE SCHEMA IF NOT EXISTS kindred;
REVOKE ALL ON SCHEMA kindred FROM PUBLIC;
CREATE TABLE IF NOT EXISTS kindred.users (
 id TEXT PRIMARY KEY,
 token TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 country TEXT NOT NULL,
 family TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kindred.rooms (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 family TEXT NOT NULL,
 host TEXT NOT NULL REFERENCES kindred.users(id),
 practice INTEGER NOT NULL CHECK(practice IN (0,1)),
 code TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 0,
 created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kindred.members (
 room TEXT NOT NULL REFERENCES kindred.rooms(id),
 "user" TEXT NOT NULL REFERENCES kindred.users(id),
 PRIMARY KEY(room,"user")
);
CREATE TABLE IF NOT EXISTS kindred.messages (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 room TEXT NOT NULL REFERENCES kindred.rooms(id),
 "user" TEXT NOT NULL,
 name TEXT NOT NULL,
 body TEXT NOT NULL,
 created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS members_user ON kindred.members("user");
CREATE INDEX IF NOT EXISTS rooms_family ON kindred.rooms(family);
CREATE INDEX IF NOT EXISTS messages_room ON kindred.messages(room,id);

COMMIT;
