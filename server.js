import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const PORT = Number(process.env.PORT || 3000);
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";

const redisOpts = { maxRetriesPerRequest: null, enableReadyCheck: true };
const redis = new Redis(REDIS_URL, redisOpts);
const pubClient = new Redis(REDIS_URL, redisOpts);
const subClient = pubClient.duplicate();

for (const [name, client] of [["redis", redis], ["pub", pubClient], ["sub", subClient]]) {
  client.on("error", (err) => console.error(`[${name}] redis error:`, err.message));
}

const mailer = GMAIL_USER && GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    })
  : null;

if (!mailer) {
  console.warn("GMAIL_USER / GMAIL_APP_PASSWORD not set — emails will be logged instead of sent");
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
io.adapter(createAdapter(pubClient, subClient));

app.use(express.json());
app.get("/health", (_req, res) => res.type("text/plain").send("ok"));
app.use(express.static(path.join(__dirname, "public")));

const rid = (n = 4) =>
  Array.from({ length: n }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");

const tok = () => crypto.randomBytes(16).toString("hex");

const keys = {
  meta: (r) => `room:${r}:meta`,
  members: (r) => `room:${r}:members`,
  state: (r) => `room:${r}:state`,
  assignments: (r) => `room:${r}:assignments`,
};

const TTL = 60 * 60 * 24 * 7;

const isEmailValid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const firstName = (n) => (n || "").trim().split(/\s+/)[0] || n;

async function refreshTtl(roomId) {
  await Promise.all([
    redis.expire(keys.meta(roomId), TTL),
    redis.expire(keys.members(roomId), TTL),
    redis.expire(keys.state(roomId), TTL),
    redis.expire(keys.assignments(roomId), TTL),
  ]);
}

async function loadRoom(roomId) {
  const meta = await redis.hgetall(keys.meta(roomId));
  if (!meta || !meta.hostToken) return null;
  const rawMembers = await redis.hgetall(keys.members(roomId));
  const members = {};
  for (const [id, json] of Object.entries(rawMembers)) {
    try { members[id] = JSON.parse(json); } catch { /* skip */ }
  }
  const state = (await redis.get(keys.state(roomId))) || "collecting";
  const assignments = await redis.hgetall(keys.assignments(roomId));
  const occasion = meta.occasion || "";
  return { meta, members, state, assignments, occasion };
}

async function publicState(roomId, viewerId) {
  const r = await loadRoom(roomId);
  if (!r) return null;
  const memberIds = Object.keys(r.members);
  const drawn = r.state === "drawn";
  const out = {
    roomId,
    state: r.state,
    occasion: r.occasion,
    hostId: r.meta.hostId,
    members: memberIds.map((id) => {
      const m = r.members[id];
      return {
        id,
        name: m.name || "",
        ready: !!(m.name && m.email && isEmailValid(m.email)),
        isHost: id === r.meta.hostId,
      };
    }),
  };
  if (drawn && viewerId && r.assignments[viewerId]) {
    const recId = r.assignments[viewerId];
    const recipient = r.members[recId];
    if (recipient) {
      out.yourPick = { name: recipient.name };
    }
  }
  return out;
}

async function broadcast(roomId) {
  const sockets = await io.in(roomId).fetchSockets();
  for (const s of sockets) {
    const viewerId = s.data?.memberId;
    const state = await publicState(roomId, viewerId);
    if (state) s.emit("state", state);
  }
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function derangement(ids) {
  if (ids.length < 2) return null;
  for (let attempt = 0; attempt < 200; attempt++) {
    const shuffled = shuffle(ids);
    let ok = true;
    for (let i = 0; i < ids.length; i++) {
      if (shuffled[i] === ids[i]) { ok = false; break; }
    }
    if (ok) {
      const map = {};
      for (let i = 0; i < ids.length; i++) map[ids[i]] = shuffled[i];
      return map;
    }
  }
  return null;
}

async function sendPickEmail(giver, receiver, occasion) {
  const subject = occasion
    ? `Your ${occasion} pick is in!`
    : `Your gift draw pick is in!`;
  const intro = occasion
    ? `for ${occasion}`
    : `out of the hat`;
  const text = `Hi ${firstName(giver.name)},

You drew ${receiver.name} ${intro}! Time to start brainstorming.

— gift draw`;
  if (!mailer) {
    console.log(`[email-stub] to=${giver.email} subject="${subject}"\n${text}`);
    return;
  }
  await mailer.sendMail({
    from: `"Gift Draw" <${GMAIL_USER}>`,
    to: giver.email,
    subject,
    text,
  });
}

app.post("/api/rooms", async (req, res) => {
  const name = (req.body?.name || "").toString().trim().slice(0, 40);
  const occasion = (req.body?.occasion || "").toString().trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "name required" });

  let roomId;
  for (let i = 0; i < 5; i++) {
    roomId = rid();
    const exists = await redis.exists(keys.meta(roomId));
    if (!exists) break;
  }
  const hostId = crypto.randomUUID();
  const hostToken = tok();
  await redis.hset(keys.meta(roomId), {
    hostId,
    hostToken,
    occasion,
    createdAt: Date.now().toString(),
  });
  await redis.hset(keys.members(roomId), hostId, JSON.stringify({ name, email: "" }));
  await redis.set(keys.state(roomId), "collecting");
  await refreshTtl(roomId);
  res.json({ roomId, hostId, hostToken });
});

io.on("connection", (socket) => {
  socket.data = {};

  socket.on("join", async ({ roomId, name, email, memberId, hostToken }, ack) => {
    roomId = (roomId || "").toUpperCase().trim();
    const r = await loadRoom(roomId);
    if (!r) return ack?.({ error: "room not found" });

    let id = memberId;
    let isHost = false;
    if (hostToken && hostToken === r.meta.hostToken) {
      id = r.meta.hostId;
      isHost = true;
    } else if (id && r.members[id]) {
      // returning member
    } else {
      id = crypto.randomUUID();
    }

    const existing = r.members[id] || {};
    const cleanName = (name ?? existing.name ?? "").toString().trim().slice(0, 40);
    const cleanEmail = (email ?? existing.email ?? "").toString().trim().slice(0, 120);
    await redis.hset(keys.members(roomId), id, JSON.stringify({
      name: cleanName,
      email: cleanEmail,
    }));
    await refreshTtl(roomId);

    socket.data = { roomId, memberId: id, isHost };
    socket.join(roomId);
    ack?.({ memberId: id, isHost });
    broadcast(roomId);
  });

  socket.on("update", async ({ name, email }, ack) => {
    const { roomId, memberId } = socket.data || {};
    if (!roomId || !memberId) return ack?.({ error: "not joined" });
    const r = await loadRoom(roomId);
    if (!r) return ack?.({ error: "room not found" });
    if (r.state === "drawn") return ack?.({ error: "draw already happened" });
    const existing = r.members[memberId] || {};
    const cleanName = (name ?? existing.name ?? "").toString().trim().slice(0, 40);
    const cleanEmail = (email ?? existing.email ?? "").toString().trim().slice(0, 120);
    await redis.hset(keys.members(roomId), memberId, JSON.stringify({
      name: cleanName,
      email: cleanEmail,
    }));
    await refreshTtl(roomId);
    ack?.({ ok: true });
    broadcast(roomId);
  });

  socket.on("kick", async ({ memberId: target }, ack) => {
    const { roomId, isHost } = socket.data || {};
    if (!isHost) return ack?.({ error: "host only" });
    const r = await loadRoom(roomId);
    if (!r) return ack?.({ error: "room not found" });
    if (target === r.meta.hostId) return ack?.({ error: "cannot kick host" });
    if (r.state === "drawn") return ack?.({ error: "draw already happened" });
    await redis.hdel(keys.members(roomId), target);
    ack?.({ ok: true });
    broadcast(roomId);
  });

  socket.on("draw", async (_payload, ack) => {
    const { roomId, isHost } = socket.data || {};
    if (!isHost) return ack?.({ error: "host only" });
    const r = await loadRoom(roomId);
    if (!r) return ack?.({ error: "room not found" });
    if (r.state === "drawn") return ack?.({ error: "already drawn" });

    const ready = Object.entries(r.members).filter(([, m]) =>
      m.name && m.email && isEmailValid(m.email)
    );
    if (ready.length < 2) return ack?.({ error: "need at least 2 people ready" });

    const ids = ready.map(([id]) => id);
    const map = derangement(ids);
    if (!map) return ack?.({ error: "couldn't generate a valid draw, try again" });

    const flat = [];
    for (const [g, rcv] of Object.entries(map)) flat.push(g, rcv);
    await redis.hset(keys.assignments(roomId), ...flat);
    await redis.set(keys.state(roomId), "drawn");
    await refreshTtl(roomId);

    const sendErrors = [];
    for (const [giverId, receiverId] of Object.entries(map)) {
      const giver = r.members[giverId];
      const receiver = r.members[receiverId];
      try {
        await sendPickEmail(giver, receiver, r.occasion);
      } catch (err) {
        console.error(`email to ${giver.email} failed:`, err.message);
        sendErrors.push(giver.email);
      }
    }

    ack?.({ ok: true, emailErrors: sendErrors });
    broadcast(roomId);
  });

  socket.on("reset", async (_payload, ack) => {
    const { roomId, isHost } = socket.data || {};
    if (!isHost) return ack?.({ error: "host only" });
    const r = await loadRoom(roomId);
    if (!r) return ack?.({ error: "room not found" });
    await redis.del(keys.assignments(roomId));
    await redis.set(keys.state(roomId), "collecting");
    await refreshTtl(roomId);
    ack?.({ ok: true });
    broadcast(roomId);
  });
});

server.listen(PORT, () => {
  console.log(`gift-draw listening on :${PORT}, redis=${REDIS_URL}`);
});
