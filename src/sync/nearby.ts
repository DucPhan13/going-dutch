import type { Group } from "@/types";
import type { GroupSyncRepository } from "./repository";

const PROTOCOL_VERSION = 1;
const CHUNK_BYTES = 18 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_RECONNECT_ROUNDS = 2;
const CONNECT_TIMEOUT_MS = 20_000;
const TRANSFER_TIMEOUT_MS = 90_000;
const SIGNAL_ENDPOINT = import.meta.env.VITE_CLOUD_SYNC_URL?.replace(/\/$/, "");

export type NearbySyncStatus = "idle" | "preparing" | "awaiting-peer" | "awaiting-offer" | "connecting" | "transferring" | "merging" | "complete" | "failed";

export interface NearbySyncState {
  status: NearbySyncStatus;
  detail: string;
  groupId?: string;
}

interface NearbySession { code: string; credential: string; expiresAt: string }
interface SignalPayload {
  kind: "description" | "candidate";
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  groupId?: string;
  sessionId?: string;
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

async function createNearbySession(): Promise<NearbySession> {
  if (!SIGNAL_ENDPOINT) throw new Error("Nearby code pairing is not configured for this app.");
  let response: Response;
  try { response = await fetch(`${SIGNAL_ENDPOINT}/v1/nearby/sessions`, { method: "POST" }); }
  catch { throw new Error("The nearby pairing service is unavailable. Check your connection and try again."); }
  const data = await response.json().catch(() => undefined) as Record<string, unknown> | undefined;
  if (!response.ok || !data || typeof data.code !== "string" || typeof data.credential !== "string" || typeof data.expiresAt !== "string") throw new Error("The nearby pairing service could not create a session.");
  return { code: data.code, credential: data.credential, expiresAt: data.expiresAt };
}

class NearbySignalClient {
  private socket: WebSocket | null = null;
  private closed = false;

  constructor(private readonly session: NearbySession, private readonly role: "host" | "guest", private readonly handlers: {
    onPeerReady: () => void;
    onPeerLeft: () => void;
    onSignal: (signal: SignalPayload) => void;
    onFailure: (message: string) => void;
  }) {}

  async connect() {
    if (!SIGNAL_ENDPOINT) throw new Error("Nearby code pairing is not configured for this app.");
    const endpoint = new URL(`${SIGNAL_ENDPOINT}/v1/nearby/${this.session.code}/signal`);
    endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(endpoint);
      this.socket = socket;
      const timer = window.setTimeout(() => reject(new Error("Nearby pairing timed out. Create a new six-digit code and try again.")), CONNECT_TIMEOUT_MS);
      socket.addEventListener("open", () => socket.send(JSON.stringify({ type: "nearby-join", role: this.role, credential: this.role === "host" ? this.session.credential : undefined })), { once: true });
      socket.addEventListener("message", event => {
        let message: Record<string, unknown>;
        try { message = JSON.parse(typeof event.data === "string" ? event.data : decoder.decode(event.data)) as Record<string, unknown>; } catch { return; }
        if (message.type === "nearby-joined") { window.clearTimeout(timer); resolve(); return; }
        if (message.type === "nearby-peer-ready") return this.handlers.onPeerReady();
        if (message.type === "nearby-peer-left") return this.handlers.onPeerLeft();
        if (message.type === "nearby-signal" && message.signal && typeof message.signal === "object") return this.handlers.onSignal(message.signal as SignalPayload);
        if (message.type === "nearby-error") {
          const detail = typeof message.message === "string" ? message.message : "Nearby pairing failed.";
          window.clearTimeout(timer);
          reject(new Error(detail));
          this.handlers.onFailure(detail);
        }
      });
      socket.addEventListener("error", () => { window.clearTimeout(timer); reject(new Error("The nearby pairing connection could not be opened.")); }, { once: true });
      socket.addEventListener("close", () => { window.clearTimeout(timer); if (!this.closed) this.handlers.onPeerLeft(); }, { once: true });
    });
  }

  sendSignal(signal: SignalPayload) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "nearby-signal", signal }));
  }

  close() {
    this.closed = true;
    this.socket?.close();
    this.socket = null;
  }
}

async function sha256(bytes: Uint8Array) {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", input)));
}

function sameHeads(left: string[], right: string[]) {
  return left.length === right.length && left.every((head, index) => head === right[index]);
}

export class NearbySyncSession {
  private connection: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private groupId = "";
  private sessionId = "";
  private incoming: IncomingSnapshot | null = null;
  private localHeads: string[] = [];
  private peerHeads: string[] | null = null;
  private signal: NearbySignalClient | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private receivedSnapshot = false;
  private sentSnapshot = false;
  private resyncRounds = 0;
  private transferTimer: number | null = null;
  private stopped = false;

  constructor(private readonly repository: GroupSyncRepository, private readonly callbacks: NearbySyncCallbacks) {}

  async createOffer(groupId: string) {
    this.reset();
    try {
      const snapshot = this.repository.getDocumentSnapshot(groupId);
      if (!snapshot) throw new Error("This group is no longer available on this device.");
      this.groupId = groupId;
      this.sessionId = crypto.randomUUID().replace(/-/g, "");
      this.localHeads = snapshot.heads;
      this.callbacks.onState({ status: "preparing", detail: "Creating a six-digit nearby pairing code…", groupId });
      const session = await createNearbySession();
      this.signal = this.createSignal(session, "host");
      await this.signal.connect();
      this.callbacks.onState({ status: "awaiting-peer", detail: "Show this code to the other device. It expires in 60 seconds.", groupId });
      return session.code;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nearby pairing could not be started.";
      this.fail(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async acceptOffer(code: string) {
    this.reset();
    try {
      const value = code.trim();
      if (!/^\d{6}$/.test(value)) throw new Error("Enter the six-digit nearby pairing code.");
      this.callbacks.onState({ status: "preparing", detail: "Joining the nearby pairing session…" });
      this.signal = this.createSignal({ code: value, credential: "", expiresAt: "" }, "guest");
      await this.signal.connect();
      this.callbacks.onState({ status: "awaiting-offer", detail: "Connected to the pairing room. Waiting for the other device…" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nearby pairing could not be joined.";
      this.fail(message);
      throw error instanceof Error ? error : new Error(message);
    }
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
    connection.addEventListener("icecandidate", event => {
      if (event.candidate) this.signal?.sendSignal({ kind: "candidate", candidate: event.candidate.toJSON() });
    });
    return connection;
  }

  private createSignal(session: NearbySession, role: "host" | "guest") {
    return new NearbySignalClient(session, role, {
      onPeerReady: () => {
        if (role === "host") void this.beginHostConnection();
      },
      onPeerLeft: () => {
        if (!this.stopped && !this.channel && this.connection?.connectionState !== "connected") this.fail("The other device left the nearby pairing room.");
      },
      onSignal: signal => { void this.receiveSignal(signal); },
      onFailure: message => { if (!this.stopped) this.fail(message); },
    });
  }

  private async beginHostConnection() {
    if (this.connection) return;
    try {
      this.callbacks.onState({ status: "connecting", detail: "Connecting directly to the other device…", groupId: this.groupId });
      const connection = this.createConnection();
      this.attachChannel(connection.createDataChannel("going-dutch-sync", { ordered: true }));
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      this.signal?.sendSignal({ kind: "description", description: connection.localDescription!.toJSON(), groupId: this.groupId, sessionId: this.sessionId });
    } catch (error) {
      this.fail(error instanceof Error ? error.message : "Could not start the nearby connection.");
    }
  }

  private async receiveSignal(signal: SignalPayload) {
    try {
      if (signal.kind === "candidate" && signal.candidate) {
        if (!this.connection || !this.remoteDescriptionSet) this.pendingCandidates.push(signal.candidate);
        else await this.connection.addIceCandidate(signal.candidate);
        return;
      }
      if (signal.kind !== "description" || !signal.description || (signal.description.type !== "offer" && signal.description.type !== "answer")) return;
      if (signal.description.type === "offer") {
        if (!signal.groupId || !signal.sessionId || this.connection) return this.fail("The nearby pairing signal is invalid.");
        this.groupId = signal.groupId;
        this.sessionId = signal.sessionId;
        this.localHeads = this.repository.getDocumentSnapshot(this.groupId)?.heads || [];
        const connection = this.createConnection();
        connection.addEventListener("datachannel", event => this.attachChannel(event.channel), { once: true });
        await connection.setRemoteDescription(signal.description);
        this.remoteDescriptionSet = true;
        await this.flushCandidates();
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        this.signal?.sendSignal({ kind: "description", description: connection.localDescription!.toJSON(), groupId: this.groupId, sessionId: this.sessionId });
        this.callbacks.onState({ status: "connecting", detail: "Connecting directly to the other device…", groupId: this.groupId });
        return;
      }
      if (!this.connection || signal.groupId !== this.groupId || signal.sessionId !== this.sessionId) return this.fail("This nearby answer belongs to a different session.");
      await this.connection.setRemoteDescription(signal.description);
      this.remoteDescriptionSet = true;
      await this.flushCandidates();
    } catch (error) {
      this.fail(error instanceof Error ? error.message : "The nearby pairing signal could not be processed.");
    }
  }

  private async flushCandidates() {
    const candidates = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of candidates) await this.connection?.addIceCandidate(candidate);
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
      window.setTimeout(() => this.reset(false), 1_000);
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
    this.signal?.close();
    this.signal = null;
    this.incoming = null;
    this.peerHeads = null;
    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;
    this.receivedSnapshot = false;
    this.sentSnapshot = false;
    this.resyncRounds = 0;
    if (emitIdle) this.callbacks.onState({ status: "idle", detail: "Ready to sync a nearby device." });
    this.stopped = false;
  }
}

export async function readNearbyPairingFragment() {
  const value = new URLSearchParams(window.location.hash.slice(1)).get("nearby");
  if (!value) return undefined;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  const code = value.trim();
  if (!/^\d{6}$/.test(code)) throw new Error("This nearby pairing link is invalid.");
  return code;
}

export function nearbyPairingUrl(code: string) {
  return `${window.location.origin}/#nearby=${encodeURIComponent(code)}`;
}
