import type { Group } from "@/types";
import { gunzipSync, gzipSync } from "fflate";
import type { GroupSyncRepository } from "./repository";

const PROTOCOL_VERSION = 1;
const CHUNK_BYTES = 18 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_RECONNECT_ROUNDS = 2;
const CONNECT_TIMEOUT_MS = 20_000;
const TRANSFER_TIMEOUT_MS = 90_000;
const ANSWER_CODE_TTL_MS = 60_000;
const ANSWER_RELAY_URL = import.meta.env.VITE_CLOUD_SYNC_URL?.replace(/\/$/, "");

export type NearbySyncStatus = "idle" | "preparing" | "awaiting-answer" | "awaiting-offer" | "connecting" | "transferring" | "merging" | "complete" | "failed";

export interface NearbySyncState {
  status: NearbySyncStatus;
  detail: string;
  groupId?: string;
}

interface PairingEnvelope {
  version: 1;
  kind: "offer" | "answer";
  sessionId: string;
  groupId: string;
  description: RTCSessionDescriptionInit;
  answerRelay?: AnswerRelay;
}

interface AnswerRelay {
  endpoint: string;
  roomId: string;
  credential: string;
  key: string;
}

interface HelloPacket {
  type: "hello";
  version: 1;
  groupId: string;
  hasDocument: boolean;
  heads: string[];
}

interface SnapshotStartPacket {
  type: "snapshot-start";
  id: string;
  bytes: number;
  chunks: number;
  hash: string;
}

interface SnapshotChunkPacket {
  type: "snapshot-chunk";
  id: string;
  index: number;
  data: string;
}

interface SnapshotEndPacket { type: "snapshot-end"; id: string }
interface HeadsPacket { type: "heads"; heads: string[] }
interface ErrorPacket { type: "error"; message: string }
type SyncPacket = HelloPacket | SnapshotStartPacket | SnapshotChunkPacket | SnapshotEndPacket | HeadsPacket | ErrorPacket;

interface IncomingSnapshot {
  id: string;
  bytes: number;
  chunks: number;
  hash: string;
  received: Map<number, Uint8Array>;
}

interface NearbySyncCallbacks {
  onState: (state: NearbySyncState) => void;
  onRemoteGroup: (group: Group) => void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function isAnswerRelay(value: unknown): value is AnswerRelay {
  if (!value || typeof value !== "object") return false;
  const relay = value as Record<string, unknown>;
  if (typeof relay.endpoint !== "string" || relay.endpoint.length > 512 || typeof relay.roomId !== "string" || typeof relay.credential !== "string" || typeof relay.key !== "string") return false;
  try { new URL(relay.endpoint); } catch { return false; }
  return /^[A-Za-z0-9_-]{24,128}$/.test(relay.roomId)
    && /^[A-Za-z0-9_-]{32,128}$/.test(relay.credential)
    && /^[A-Za-z0-9_-]{43}$/.test(relay.key);
}

function isPairingEnvelope(value: unknown): value is PairingEnvelope {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return data.version === PROTOCOL_VERSION
    && (data.kind === "offer" || data.kind === "answer")
    && typeof data.sessionId === "string"
    && /^[A-Za-z0-9_-]{20,80}$/.test(data.sessionId)
    && typeof data.groupId === "string"
    && data.description !== null
    && typeof data.description === "object"
    && (data.answerRelay === undefined || isAnswerRelay(data.answerRelay));
}

async function encodePairingEnvelope(value: PairingEnvelope) {
  const plain = encoder.encode(JSON.stringify(value));
  // CompressionStream can stall in embedded browsers. fflate is bundled, runs
  // synchronously, and keeps the SDP-rich WebRTC offer small enough to scan.
  return `g.${bytesToBase64Url(gzipSync(plain, { level: 6 }))}`;
}

async function decodePairingEnvelope(code: string) {
  const [mode, encoded] = code.trim().split(".", 2);
  if (!encoded || (mode !== "r" && mode !== "g")) throw new Error("This pairing code is invalid.");
  let payload = base64UrlToBytes(encoded);
  if (mode === "g") {
    try { payload = gunzipSync(payload); }
    catch { throw new Error("This pairing code could not be decompressed."); }
  }
  if (payload.byteLength > 16 * 1024) throw new Error("This pairing code is too large.");
  let parsed: unknown;
  try { parsed = JSON.parse(decoder.decode(payload)); } catch { throw new Error("This pairing code could not be read."); }
  if (!isPairingEnvelope(parsed)) throw new Error("This pairing code is not supported.");
  return parsed;
}

function sixDigitCode() {
  const upperBound = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  while (true) {
    const value = crypto.getRandomValues(new Uint32Array(1))[0];
    if (value < upperBound) return String(value % 1_000_000).padStart(6, "0");
  }
}

async function answerRelayKey(relay: AnswerRelay, usage: KeyUsage[]) {
  const raw = base64UrlToBytes(relay.key);
  if (raw.byteLength !== 32) throw new Error("This nearby pairing link has an invalid answer key.");
  return crypto.subtle.importKey("raw", toArrayBuffer(raw), "AES-GCM", false, usage);
}

async function encryptRelayAnswer(relay: AnswerRelay, answer: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await answerRelayKey(relay, ["encrypt"]), toArrayBuffer(encoder.encode(answer))));
  const payload = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  payload.set(iv);
  payload.set(ciphertext, iv.byteLength);
  return bytesToBase64Url(payload);
}

async function decryptRelayAnswer(relay: AnswerRelay, payload: string) {
  let encrypted: Uint8Array;
  try { encrypted = base64UrlToBytes(payload); } catch { throw new Error("The nearby answer could not be read."); }
  if (encrypted.byteLength < 29 || encrypted.byteLength > 80 * 1024) throw new Error("The nearby answer is invalid.");
  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: encrypted.subarray(0, 12) }, await answerRelayKey(relay, ["decrypt"]), toArrayBuffer(encrypted.subarray(12)));
    return decoder.decode(plaintext);
  } catch { throw new Error("The nearby answer could not be decrypted."); }
}

async function createAnswerRelay(): Promise<AnswerRelay | undefined> {
  if (!ANSWER_RELAY_URL) return undefined;
  let response: Response;
  try { response = await fetch(`${ANSWER_RELAY_URL}/v1/nearby`, { method: "POST" }); }
  catch { throw new Error("The temporary answer-code service is unavailable. Check your connection and try again."); }
  let body: unknown;
  try { body = await response.json(); } catch { body = undefined; }
  const data = body as Record<string, unknown> | undefined;
  if (!response.ok || !data || typeof data.roomId !== "string" || typeof data.credential !== "string") {
    throw new Error("The temporary answer-code service could not create a pairing session.");
  }
  return { endpoint: ANSWER_RELAY_URL, roomId: data.roomId, credential: data.credential, key: bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32))) };
}

async function publishRelayAnswer(relay: AnswerRelay, code: string, answer: string) {
  const response = await fetch(`${relay.endpoint}/v1/nearby/${relay.roomId}/${code}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${relay.credential}`, "Content-Type": "application/json" },
    body: JSON.stringify({ answer: await encryptRelayAnswer(relay, answer) }),
  });
  if (!response.ok) throw new Error("The temporary answer code could not be published. Try pairing again.");
}

async function readRelayAnswer(relay: AnswerRelay, code: string) {
  let response: Response;
  try { response = await fetch(`${relay.endpoint}/v1/nearby/${relay.roomId}/${code}`, { headers: { Authorization: `Bearer ${relay.credential}` } }); }
  catch { throw new Error("The temporary answer-code service is unavailable. Check your connection and try again."); }
  if (response.status === 404 || response.status === 410) throw new Error("That six-digit answer code has expired or was already used. Pair again.");
  let body: unknown;
  try { body = await response.json(); } catch { body = undefined; }
  const answer = (body as Record<string, unknown> | undefined)?.answer;
  if (!response.ok || typeof answer !== "string") throw new Error("The temporary answer code could not be read. Try pairing again.");
  return decryptRelayAnswer(relay, answer);
}

async function sha256(bytes: Uint8Array) {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", input)));
}

function sameHeads(left: string[], right: string[]) {
  return left.length === right.length && left.every((head, index) => head === right[index]);
}

async function waitForIceGathering(connection: RTCPeerConnection) {
  if (connection.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Nearby connection setup timed out.")), CONNECT_TIMEOUT_MS);
    const onStateChange = () => {
      if (connection.iceGatheringState !== "complete") return;
      window.clearTimeout(timer);
      connection.removeEventListener("icegatheringstatechange", onStateChange);
      resolve();
    };
    connection.addEventListener("icegatheringstatechange", onStateChange);
  });
}

export class NearbySyncSession {
  private connection: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private groupId = "";
  private sessionId = "";
  private incoming: IncomingSnapshot | null = null;
  private localHeads: string[] = [];
  private peerHeads: string[] | null = null;
  private answerRelay: AnswerRelay | undefined;
  private receivedSnapshot = false;
  private sentSnapshot = false;
  private resyncRounds = 0;
  private transferTimer: number | null = null;
  private stopped = false;

  constructor(private readonly repository: GroupSyncRepository, private readonly callbacks: NearbySyncCallbacks) {}

  async createOffer(groupId: string) {
    this.reset();
    const snapshot = this.repository.getDocumentSnapshot(groupId);
    if (!snapshot) throw new Error("This group is no longer available on this device.");
    this.groupId = groupId;
    this.sessionId = crypto.randomUUID().replace(/-/g, "");
    this.localHeads = snapshot.heads;
    this.callbacks.onState({ status: "preparing", detail: "Preparing a nearby connection…", groupId });
    this.answerRelay = await createAnswerRelay();
    const connection = this.createConnection();
    const channel = connection.createDataChannel("going-dutch-sync", { ordered: true });
    this.attachChannel(channel);
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await waitForIceGathering(connection);
    this.callbacks.onState({ status: "awaiting-answer", detail: this.answerRelay ? "Scan this code on the other device, then enter its six-digit answer within 60 seconds." : "Scan this code on the other device, then scan its answer.", groupId });
    return encodePairingEnvelope({ version: 1, kind: "offer", sessionId: this.sessionId, groupId, description: connection.localDescription!.toJSON(), answerRelay: this.answerRelay });
  }

  async acceptOffer(code: string) {
    this.reset();
    const offer = await decodePairingEnvelope(code);
    if (offer.kind !== "offer") throw new Error("Scan an offer code to receive a nearby sync.");
    this.groupId = offer.groupId;
    this.sessionId = offer.sessionId;
    const local = this.repository.getDocumentSnapshot(this.groupId);
    this.localHeads = local?.heads || [];
    this.callbacks.onState({ status: "preparing", detail: "Preparing your response code…", groupId: this.groupId });
    const connection = this.createConnection();
    connection.addEventListener("datachannel", event => this.attachChannel(event.channel), { once: true });
    await connection.setRemoteDescription(offer.description);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    await waitForIceGathering(connection);
    const response = await encodePairingEnvelope({ version: 1, kind: "answer", sessionId: this.sessionId, groupId: this.groupId, description: connection.localDescription!.toJSON() });
    if (!offer.answerRelay) {
      this.callbacks.onState({ status: "connecting", detail: "Show this answer code to the first device.", groupId: this.groupId });
      return response;
    }
    const answerCode = sixDigitCode();
    await publishRelayAnswer(offer.answerRelay, answerCode, response);
    this.callbacks.onState({ status: "connecting", detail: `Show the six-digit answer within ${ANSWER_CODE_TTL_MS / 1000} seconds.`, groupId: this.groupId });
    return answerCode;
  }

  async acceptAnswer(code: string) {
    const value = code.trim();
    let answerValue = value;
    if (/^\d{6}$/.test(value)) {
      if (!this.answerRelay) throw new Error("This pairing session does not use a six-digit answer code.");
      answerValue = await readRelayAnswer(this.answerRelay, value);
    }
    const answer = await decodePairingEnvelope(answerValue);
    if (answer.kind !== "answer" || answer.sessionId !== this.sessionId || answer.groupId !== this.groupId || !this.connection) {
      throw new Error("This answer belongs to a different nearby sync session.");
    }
    await this.connection.setRemoteDescription(answer.description);
    this.callbacks.onState({ status: "connecting", detail: "Connecting directly to the other device…", groupId: this.groupId });
  }

  cancel = () => this.reset();

  private createConnection() {
    const connection = new RTCPeerConnection({ iceServers: [] });
    this.connection = connection;
    connection.addEventListener("connectionstatechange", () => {
      if (this.connection !== connection) return;
      if (connection.connectionState === "failed") this.fail("Nearby connection failed. Check that both devices are on the same Wi-Fi, or use cloud transfer.");
      if (connection.connectionState === "disconnected") window.setTimeout(() => {
        if (this.connection === connection && connection.connectionState === "disconnected") this.fail("Nearby connection was interrupted.");
      }, 10_000);
    });
    return connection;
  }

  private attachChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = 256 * 1024;
    channel.addEventListener("open", () => { void this.beginTransfer(); }, { once: true });
    channel.addEventListener("message", event => { void this.receive(typeof event.data === "string" ? event.data : decoder.decode(event.data)); });
    channel.addEventListener("close", () => {
      if (!this.stopped && this.channel === channel) this.fail("Nearby connection closed before sync finished.");
    });
    channel.addEventListener("error", () => {
      if (this.channel === channel) this.fail("Nearby connection encountered an error.");
    });
  }

  private async beginTransfer() {
    this.callbacks.onState({ status: "transferring", detail: "Exchanging encrypted group changes directly…", groupId: this.groupId });
    this.transferTimer = window.setTimeout(() => this.fail("Nearby sync took too long. Try again or use cloud transfer."), TRANSFER_TIMEOUT_MS);
    const snapshot = this.repository.getDocumentSnapshot(this.groupId);
    this.localHeads = snapshot?.heads || [];
    await this.send({ type: "hello", version: PROTOCOL_VERSION, groupId: this.groupId, hasDocument: Boolean(snapshot), heads: this.localHeads });
    if (snapshot) await this.sendSnapshot(snapshot.data);
    else await this.sendHeads();
  }

  private async sendSnapshot(data: Uint8Array) {
    if (data.byteLength > MAX_DOCUMENT_BYTES) throw new Error("This group is too large for nearby sync.");
    this.sentSnapshot = true;
    const id = crypto.randomUUID();
    const chunks = Math.ceil(data.byteLength / CHUNK_BYTES);
    await this.send({ type: "snapshot-start", id, bytes: data.byteLength, chunks, hash: await sha256(data) });
    for (let index = 0; index < chunks; index += 1) {
      await this.send({ type: "snapshot-chunk", id, index, data: bytesToBase64(data.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES)) });
    }
    await this.send({ type: "snapshot-end", id });
  }

  private async receive(raw: string) {
    let packet: SyncPacket;
    try { packet = JSON.parse(raw) as SyncPacket; } catch { this.fail("The other device sent an unreadable sync message."); return; }
    if (packet.type === "hello") {
      if (packet.version !== PROTOCOL_VERSION || packet.groupId !== this.groupId) return this.fail("The devices selected different groups.");
      this.peerHeads = [...packet.heads].sort();
      if (!packet.hasDocument) {
        this.receivedSnapshot = true;
        await this.sendHeads();
      }
      return;
    }
    if (packet.type === "snapshot-start") {
      if (!Number.isInteger(packet.bytes) || packet.bytes < 0 || packet.bytes > MAX_DOCUMENT_BYTES || !Number.isInteger(packet.chunks) || packet.chunks < 0 || packet.chunks > 1024) return this.fail("The incoming group is too large.");
      this.incoming = { id: packet.id, bytes: packet.bytes, chunks: packet.chunks, hash: packet.hash, received: new Map() };
      return;
    }
    if (packet.type === "snapshot-chunk") {
      if (!this.incoming || packet.id !== this.incoming.id || !Number.isInteger(packet.index) || packet.index < 0 || packet.index >= this.incoming.chunks || this.incoming.received.has(packet.index)) return;
      try { this.incoming.received.set(packet.index, base64ToBytes(packet.data)); } catch { this.fail("An incoming sync chunk is invalid."); }
      return;
    }
    if (packet.type === "snapshot-end") {
      if (!this.incoming || packet.id !== this.incoming.id || this.incoming.received.size !== this.incoming.chunks) return this.fail("The incoming group transfer was incomplete.");
      const parts = [...this.incoming.received.entries()].sort(([a], [b]) => a - b).map(([, value]) => value);
      const data = new Uint8Array(parts.reduce((length, item) => length + item.byteLength, 0));
      let offset = 0;
      for (const part of parts) { data.set(part, offset); offset += part.byteLength; }
      const incoming = this.incoming;
      this.incoming = null;
      if (data.byteLength !== incoming.bytes || await sha256(data) !== incoming.hash) return this.fail("The incoming group did not pass its integrity check.");
      this.callbacks.onState({ status: "merging", detail: "Merging group changes safely…", groupId: this.groupId });
      try {
        const result = await this.repository.mergeRemoteDocument(data);
        this.localHeads = result.heads;
        this.receivedSnapshot = true;
        this.callbacks.onRemoteGroup(result.group);
        await this.sendHeads();
      } catch (error) {
        this.fail(error instanceof Error ? error.message : "The incoming group could not be merged.");
      }
      return;
    }
    if (packet.type === "heads") {
      this.peerHeads = [...packet.heads].sort();
      this.checkComplete();
      return;
    }
    if (packet.type === "error") this.fail(packet.message || "The other device stopped sync.");
  }

  private async sendHeads() {
    const snapshot = this.repository.getDocumentSnapshot(this.groupId);
    this.localHeads = snapshot?.heads || [];
    await this.send({ type: "heads", heads: this.localHeads });
    this.checkComplete();
  }

  private checkComplete() {
    if (!this.receivedSnapshot || !this.peerHeads) return;
    if (sameHeads(this.localHeads, this.peerHeads)) {
      if (this.transferTimer !== null) window.clearTimeout(this.transferTimer);
      this.callbacks.onState({ status: "complete", detail: "Nearby sync complete.", groupId: this.groupId });
      window.setTimeout(() => this.reset(), 1_000);
      return;
    }
    if (this.resyncRounds >= MAX_RECONNECT_ROUNDS || !this.sentSnapshot) return this.fail("The two copies did not converge. Try sync again.");
    this.resyncRounds += 1;
    const snapshot = this.repository.getDocumentSnapshot(this.groupId);
    if (snapshot) void this.sendSnapshot(snapshot.data);
  }

  private async send(packet: SyncPacket) {
    const channel = this.channel;
    if (!channel || channel.readyState !== "open") throw new Error("Nearby connection is not ready.");
    if (channel.bufferedAmount > 512 * 1024) {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("Nearby connection is congested.")), 10_000);
        const low = () => { window.clearTimeout(timer); channel.removeEventListener("bufferedamountlow", low); resolve(); };
        channel.addEventListener("bufferedamountlow", low);
      });
    }
    channel.send(JSON.stringify(packet));
  }

  private fail(detail: string) {
    if (this.stopped) return;
    this.callbacks.onState({ status: "failed", detail, groupId: this.groupId || undefined });
    this.reset(false);
  }

  private reset(emitIdle = true) {
    this.stopped = true;
    if (this.transferTimer !== null) window.clearTimeout(this.transferTimer);
    this.transferTimer = null;
    this.channel?.close();
    this.connection?.close();
    this.channel = null;
    this.connection = null;
    this.incoming = null;
    this.peerHeads = null;
    this.receivedSnapshot = false;
    this.sentSnapshot = false;
    this.resyncRounds = 0;
    this.answerRelay = undefined;
    if (emitIdle) this.callbacks.onState({ status: "idle", detail: "Ready to sync a nearby device." });
    this.stopped = false;
  }
}

export async function readNearbyPairingFragment() {
  const value = new URLSearchParams(window.location.hash.slice(1)).get("nearby");
  if (!value) return undefined;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  await decodePairingEnvelope(value);
  return value;
}

export function nearbyPairingUrl(code: string) {
  return `${window.location.origin}${window.location.pathname}#nearby=${encodeURIComponent(code)}`;
}
