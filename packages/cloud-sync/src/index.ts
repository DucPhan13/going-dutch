import { DurableObject } from "cloudflare:workers";

const PAIRING_TTL_MS = 5 * 60 * 1000;
const NEARBY_SESSION_TTL_MS = 60 * 1000;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DEVICE_ID_LENGTH = 120;
const MAX_DEVICE_NAME_LENGTH = 80;
const MAX_CREDENTIAL_LENGTH = 256;
const MAX_DEVICE_REQUEST_BYTES = 4 * 1024;
const MAX_FRAME_LENGTH = 256 * 1024;
const MAX_NEARBY_SIGNAL_LENGTH = 32 * 1024;
const MAX_ROOM_CONNECTIONS = 2;
const CREATION_RATE_WINDOW_MS = 60 * 1000;
const MAX_CREATIONS_PER_IP_PER_WINDOW = 5;

interface DeviceRecord {
  deviceId: string;
  deviceName: string;
  pairedAt: string;
}

interface PairingRecord { expiresAt: number }
interface NearbySessionRecord { expiresAt: number }
interface RateLimitRecord { count: number; resetAt: number }
interface SocketAttachment { authorized: boolean; deviceId?: string; nearbyRole?: "host" | "guest" }

type BoundedJsonResult =
  | { value: unknown }
  | { error: "invalid-json" | "payload-too-large" };

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function token(byteLength = 24) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sixDigitCode() {
  const upperBound = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  while (true) {
    const value = crypto.getRandomValues(new Uint32Array(1))[0];
    if (value < upperBound) return String(value % 1_000_000).padStart(6, "0");
  }
}

async function hash(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function roomId(value: string | undefined) {
  return Boolean(value && /^[A-Za-z0-9_-]{24,128}$/.test(value));
}

function authorization(request: Request) {
  const value = request.headers.get("Authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : undefined;
}

function cors(request: Request, env: Env): Record<string, string> | undefined {
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGINS.split(",").map(value => value.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  return undefined;
}

async function readBoundedJson(request: Request, maxBytes: number): Promise<BoundedJsonResult> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) return { error: "payload-too-large" };
  if (!request.body) return { error: "invalid-json" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { error: "payload-too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { error: "invalid-json" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { error: "invalid-json" };
  }
}

function websocketMessageByteLength(message: ArrayBuffer | string) {
  return typeof message === "string" ? new TextEncoder().encode(message).byteLength : message.byteLength;
}

function send(socket: WebSocket, message: unknown) {
  try { socket.send(JSON.stringify(message)); } catch { /* Closing peers are ignored. */ }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = cors(request, env);
    if (!corsHeaders) return json({ error: request.headers.get("Origin") ? "origin-not-allowed" : "origin-required" }, { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok", service: "going-dutch-sync" }, { headers: corsHeaders });
    if (request.method === "POST" && url.pathname === "/v1/rooms") {
      const rateLimitResponse = await enforceCreationRateLimit(request, env, corsHeaders);
      if (rateLimitResponse) return rateLimitResponse;
      const id = token(24);
      const headers = new Headers(request.headers);
      headers.set("X-Going-Dutch-Action", "bootstrap");
      const response = await env.SYNC_ROOMS.getByName(id).fetch(new Request(request, { headers }));
      const body = await response.json<Record<string, unknown>>();
      return json({ ...body, roomId: response.ok ? id : undefined }, { status: response.status, headers: corsHeaders });
    }
    if (request.method === "POST" && url.pathname === "/v1/nearby/sessions") {
      const rateLimitResponse = await enforceCreationRateLimit(request, env, corsHeaders);
      if (rateLimitResponse) return rateLimitResponse;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = sixDigitCode();
        const headers = new Headers(request.headers);
        headers.set("X-Going-Dutch-Action", "nearby-create-session");
        const response = await env.SYNC_ROOMS.getByName(`nearby:${code}`).fetch(new Request(request, { headers }));
        if (response.status === 409) continue;
        const body = await response.json<Record<string, unknown>>();
        return json({ ...body, code: response.ok ? code : undefined }, { status: response.status, headers: corsHeaders });
      }
      return json({ error: "code-unavailable" }, { status: 503, headers: corsHeaders });
    }
    const nearbySignal = url.pathname.match(/^\/v1\/nearby\/(\d{6})\/signal$/);
    if (nearbySignal && request.method === "GET") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected Upgrade: websocket", { status: 426, headers: corsHeaders });
      const headers = new Headers(request.headers);
      headers.set("X-Going-Dutch-Action", "nearby-signal");
      return env.SYNC_ROOMS.getByName(`nearby:${nearbySignal[1]}`).fetch(new Request(request, { headers }));
    }
    const match = url.pathname.match(/^\/v1\/rooms\/([A-Za-z0-9_-]{24,128})\/(pair|sync)$/);
    if (!match || !roomId(match[1])) return json({ error: "not-found" }, { status: 404, headers: corsHeaders });
    const [, id, action] = match;
    if (action === "pair" && request.method === "POST") {
      const headers = new Headers(request.headers);
      headers.set("X-Going-Dutch-Action", "pair");
      const response = await env.SYNC_ROOMS.getByName(id).fetch(new Request(request, { headers }));
      const responseHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders)) responseHeaders.set(key, value);
      return new Response(response.body, { status: response.status, headers: responseHeaders });
    }
    if (action === "sync" && request.method === "GET") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected Upgrade: websocket", { status: 426, headers: corsHeaders });
      return env.SYNC_ROOMS.getByName(id).fetch(request);
    }
    return json({ error: "not-found" }, { status: 404, headers: corsHeaders });
  },
} satisfies ExportedHandler<Env>;

async function enforceCreationRateLimit(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (!clientIp) return json({ error: "client-ip-required" }, { status: 400, headers: corsHeaders });
  const rateLimiter = env.SYNC_ROOMS.getByName(`rate:${await hash(clientIp)}`);
  const response = await rateLimiter.fetch(new Request("https://rate-limit.internal/", {
    method: "POST",
    headers: { "X-Going-Dutch-Action": "rate-limit" },
  }));
  if (response.ok) return undefined;
  const headers = new Headers(corsHeaders);
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) headers.set("Retry-After", retryAfter);
  return json({ error: "rate-limited" }, { status: response.status, headers });
}

export class GroupSyncRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const action = request.headers.get("X-Going-Dutch-Action");
    if (action === "rate-limit") return this.consumeCreationAllowance();
    if (action === "bootstrap") return this.bootstrap(request);
    if (action === "pair") return this.createPairing(request);
    if (action === "nearby-create-session") return this.createNearbySession();
    if (action === "nearby-signal") return this.openNearbySignal(request);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected Upgrade: websocket", { status: 426 });
    if (!(await this.roomIsActive())) return json({ error: "room-expired" }, { status: 410 });
    if (this.ctx.getWebSockets().length >= MAX_ROOM_CONNECTIONS) return json({ error: "room-full" }, { status: 429 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ authorized: false } satisfies SocketAttachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: ArrayBuffer | string) {
    let value: Record<string, unknown>;
    try {
      if (websocketMessageByteLength(message) > MAX_FRAME_LENGTH) throw new Error("too-large");
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      value = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return send(socket, { type: "error", code: "invalid-message", message: "The temporary relay could not read that message." });
    }
    if (value.type === "nearby-join") return this.joinNearby(socket, value);
    if (value.type === "nearby-signal") return this.relayNearbySignal(socket, value);
    if (value.type === "authenticate") return this.authenticate(socket, value);
    if (value.type === "ping") return send(socket, { type: "pong" });
    if (!this.attachment(socket).authorized) return send(socket, { type: "error", code: "not-authenticated", message: "Pair this browser before transferring." });
    if (value.type !== "frame" || typeof value.data !== "string" || value.data.length === 0 || value.data.length > MAX_FRAME_LENGTH) {
      return send(socket, { type: "error", code: "invalid-frame", message: "The transfer frame is invalid." });
    }
    for (const peer of this.ctx.getWebSockets()) if (this.attachment(peer).authorized) send(peer, { type: "frame", data: value.data });
  }

  webSocketClose(socket: WebSocket) {
    const attachment = this.attachment(socket);
    if (attachment.nearbyRole) {
      for (const peer of this.ctx.getWebSockets()) if (peer !== socket && this.attachment(peer).nearbyRole) send(peer, { type: "nearby-peer-left" });
      return;
    }
    if (!attachment.authorized) return;
    for (const peer of this.ctx.getWebSockets()) if (peer !== socket && this.attachment(peer).authorized) send(peer, { type: "peer-left" });
  }

  async alarm() {
    for (const socket of this.ctx.getWebSockets()) socket.close(4001, "Temporary sync room expired.");
    await this.ctx.storage.deleteAll();
  }

  private async bootstrap(request: Request) {
    if (await this.ctx.storage.get<boolean>("room:created")) return json({ error: "room-exists" }, { status: 409 });
    const device = await this.readDevice(request);
    if ("error" in device) return json({ error: device.error }, { status: device.error === "payload-too-large" ? 413 : 400 });
    const credential = token(32);
    await this.ctx.storage.put({ "room:created": true, "room:expires": Date.now() + ROOM_TTL_MS, [`device:${await hash(credential)}`]: { ...device, pairedAt: new Date().toISOString() } satisfies DeviceRecord });
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
    return json({ credential });
  }

  private async createPairing(request: Request) {
    if (!(await this.roomIsActive())) return json({ error: "room-expired" }, { status: 410 });
    if (!(await this.deviceForCredential(authorization(request)))) return json({ error: "not-paired" }, { status: 401 });
    const pairToken = token(24);
    const expiresAt = Date.now() + PAIRING_TTL_MS;
    await this.ctx.storage.put(`pair:${await hash(pairToken)}`, { expiresAt } satisfies PairingRecord);
    return json({ pairingToken: pairToken, expiresAt: new Date(expiresAt).toISOString() }, { status: 201 });
  }

  private async createNearbySession() {
    const existingSession = await this.ctx.storage.get<NearbySessionRecord>("nearby:session");
    if (existingSession && existingSession.expiresAt > Date.now()) return json({ error: "code-exists" }, { status: 409 });
    if (existingSession) await this.ctx.storage.deleteAll();
    const credential = token(32);
    const expiresAt = Date.now() + NEARBY_SESSION_TTL_MS;
    await this.ctx.storage.put({
      "nearby:session": { expiresAt } satisfies NearbySessionRecord,
      [`nearby:host:${await hash(credential)}`]: true,
    });
    await this.ctx.storage.setAlarm(expiresAt);
    return json({ credential, expiresAt: new Date(expiresAt).toISOString() }, { status: 201 });
  }

  private async openNearbySignal(request: Request) {
    const session = await this.ctx.storage.get<NearbySessionRecord>("nearby:session");
    if (!session || session.expiresAt <= Date.now()) return json({ error: "pairing-expired" }, { status: 410 });
    if (this.ctx.getWebSockets().length >= MAX_ROOM_CONNECTIONS) return json({ error: "room-full" }, { status: 429 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ authorized: false } satisfies SocketAttachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async joinNearby(socket: WebSocket, value: Record<string, unknown>) {
    const session = await this.ctx.storage.get<NearbySessionRecord>("nearby:session");
    if (!session || session.expiresAt <= Date.now()) return send(socket, { type: "nearby-error", message: "This six-digit code has expired. Ask the first device to create a new one." });
    const role = value.role === "host" || value.role === "guest" ? value.role : undefined;
    if (!role) return send(socket, { type: "nearby-error", message: "This nearby pairing role is invalid." });
    const peers = this.ctx.getWebSockets().filter(peer => this.attachment(peer).nearbyRole);
    if (peers.some(peer => this.attachment(peer).nearbyRole === role) || peers.length >= 2) return send(socket, { type: "nearby-error", message: "This nearby pairing room is already full." });
    if (role === "host") {
      const credential = typeof value.credential === "string" ? value.credential : undefined;
      if (!credential || credential.length > 256 || !await this.ctx.storage.get<boolean>(`nearby:host:${await hash(credential)}`)) return send(socket, { type: "nearby-error", message: "This device cannot host that nearby pairing code." });
    }
    if (role === "guest" && !peers.some(peer => this.attachment(peer).nearbyRole === "host")) return send(socket, { type: "nearby-error", message: "The first device is no longer waiting for this code." });
    socket.serializeAttachment({ authorized: true, nearbyRole: role } satisfies SocketAttachment);
    send(socket, { type: "nearby-joined" });
    const joined = this.ctx.getWebSockets().filter(peer => this.attachment(peer).nearbyRole);
    if (joined.length === 2) for (const peer of joined) send(peer, { type: "nearby-peer-ready" });
  }

  private relayNearbySignal(socket: WebSocket, value: Record<string, unknown>) {
    const attachment = this.attachment(socket);
    const signal = value.signal;
    if (!attachment.nearbyRole || !signal || typeof signal !== "object" || new TextEncoder().encode(JSON.stringify(signal)).byteLength > MAX_NEARBY_SIGNAL_LENGTH) return send(socket, { type: "nearby-error", message: "The nearby pairing message is invalid." });
    const payload = signal as Record<string, unknown>;
    if ((payload.kind !== "description" && payload.kind !== "candidate") || (payload.kind === "description" && (!payload.description || typeof payload.description !== "object")) || (payload.kind === "candidate" && (!payload.candidate || typeof payload.candidate !== "object"))) return send(socket, { type: "nearby-error", message: "The nearby pairing message is invalid." });
    for (const peer of this.ctx.getWebSockets()) if (peer !== socket && this.attachment(peer).nearbyRole) send(peer, { type: "nearby-signal", signal });
  }

  private async authenticate(socket: WebSocket, value: Record<string, unknown>) {
    if (!(await this.roomIsActive())) return send(socket, { type: "error", code: "room-expired", message: "This temporary sync room has expired." });
    const deviceId = typeof value.deviceId === "string" && value.deviceId.length <= MAX_DEVICE_ID_LENGTH ? value.deviceId : "";
    if (!deviceId) return send(socket, { type: "error", code: "invalid-device", message: "This browser did not provide a device identity." });
    const deviceName = typeof value.deviceName === "string" && value.deviceName.length <= MAX_DEVICE_NAME_LENGTH ? value.deviceName : "Browser";
    let credential = typeof value.credential === "string" ? value.credential : undefined;
    let device = await this.deviceForCredential(credential);
    if (!device && typeof value.pairingToken === "string" && value.pairingToken.length <= MAX_CREDENTIAL_LENGTH) {
      const pairingKey = `pair:${await hash(value.pairingToken)}`;
      const pairing = await this.ctx.storage.get<PairingRecord>(pairingKey);
      const devices = await this.ctx.storage.list<DeviceRecord>({ prefix: "device:" });
      if (!pairing || pairing.expiresAt <= Date.now()) return send(socket, { type: "error", code: "pairing-expired", message: "This cloud pairing link has expired." });
      if (devices.size >= 2) return send(socket, { type: "error", code: "room-full", message: "This temporary sync room already has two devices." });
      credential = token(32);
      device = { deviceId, deviceName, pairedAt: new Date().toISOString() };
      await this.ctx.storage.put(`device:${await hash(credential)}`, device);
      await this.ctx.storage.delete(pairingKey);
    }
    if (!device || !credential || device.deviceId !== deviceId) return send(socket, { type: "error", code: "not-paired", message: "This browser is not paired with this temporary room." });
    socket.serializeAttachment({ authorized: true, deviceId } satisfies SocketAttachment);
    send(socket, { type: "authenticated", credential });
    const peers = this.ctx.getWebSockets().filter(peer => this.attachment(peer).authorized);
    if (peers.length === 2) for (const peer of peers) send(peer, { type: "peer-ready" });
  }

  private async readDevice(request: Request): Promise<{ deviceId: string; deviceName: string } | { error: "invalid-device" | "payload-too-large" }> {
    const body = await readBoundedJson(request, MAX_DEVICE_REQUEST_BYTES);
    if ("error" in body) return { error: body.error === "payload-too-large" ? body.error : "invalid-device" };
    if (!body.value || typeof body.value !== "object") return { error: "invalid-device" };
    const input = body.value as Record<string, unknown>;
    if (typeof input.deviceId !== "string" || input.deviceId.length === 0 || input.deviceId.length > MAX_DEVICE_ID_LENGTH) return { error: "invalid-device" };
    if (input.deviceName !== undefined && (typeof input.deviceName !== "string" || input.deviceName.length > MAX_DEVICE_NAME_LENGTH)) return { error: "invalid-device" };
    return { deviceId: input.deviceId, deviceName: typeof input.deviceName === "string" ? input.deviceName : "Browser" };
  }

  private async deviceForCredential(credential: string | undefined) {
    if (!credential || credential.length > MAX_CREDENTIAL_LENGTH) return undefined;
    return this.ctx.storage.get<DeviceRecord>(`device:${await hash(credential)}`);
  }

  private async roomIsActive() {
    const expiresAt = await this.ctx.storage.get<number>("room:expires");
    return Boolean(expiresAt && expiresAt > Date.now());
  }

  private async consumeCreationAllowance() {
    const now = Date.now();
    const existing = await this.ctx.storage.get<RateLimitRecord>("rate-limit");
    const current = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + CREATION_RATE_WINDOW_MS }
      : existing;
    if (current.count >= MAX_CREATIONS_PER_IP_PER_WINDOW) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      return json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
    }
    const next = { ...current, count: current.count + 1 } satisfies RateLimitRecord;
    await this.ctx.storage.put("rate-limit", next);
    await this.ctx.storage.setAlarm(next.resetAt);
    return json({ ok: true });
  }

  private attachment(socket: WebSocket): SocketAttachment {
    const value = socket.deserializeAttachment();
    return value && typeof value === "object" ? value as SocketAttachment : { authorized: false };
  }
}
