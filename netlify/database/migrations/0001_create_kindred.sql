CREATE TABLE users (
 id TEXT PRIMARY KEY,
 token TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 country TEXT NOT NULL,
 family TEXT NOT NULL
);
CREATE TABLE rooms (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 family TEXT NOT NULL,
 host TEXT NOT NULL REFERENCES users(id),
 practice INTEGER NOT NULL CHECK(practice IN (0,1)),
 code TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 0,
 created TEXT NOT NULL
);
CREATE TABLE members (
 room TEXT NOT NULL REFERENCES rooms(id),
 "user" TEXT NOT NULL REFERENCES users(id),
 PRIMARY KEY(room,"user")
);
CREATE TABLE messages (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 room TEXT NOT NULL REFERENCES rooms(id),
 "user" TEXT NOT NULL,
 name TEXT NOT NULL,
 body TEXT NOT NULL,
 created TEXT NOT NULL
);
CREATE INDEX members_user ON members("user");
CREATE INDEX rooms_family ON rooms(family);
CREATE INDEX messages_room ON messages(room,id);
