import type { Group } from "@/types";
import type { GroupSyncRepository } from "./repository";

const DEVICE_ID_KEY = "going-dutch-cloud-device-id-v1";
const CHUNK_BYTES = 18 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type CloudSyncStatus = "idle" | "creating" | "awaiting-peer" | "transferring" | "merging" | "complete" | "failed";
export interface CloudSyncState { status: CloudSyncStatus; detail: string; groupId?: string }

interface CloudConfig { endpoint: string; roomId: string; credential?: string; pairingToken?: string; key: string; groupId: string }
interface CloudCallbacks { onState: (state: CloudSyncState) => void; onRemoteGroup: (group: Group) => void }
interface Incoming { id: string; bytes: number; chunks: number; hash: string; chunksByIndex: Map<number, Uint8Array> }

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
function base64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}
function fromBase64(value: string) { return Uint8Array.from(atob(value), character => character.charCodeAt(0)); }
function getDeviceId() { let id = localStorage.getItem(DEVICE_ID_KEY); if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_ID_KEY, id); } return id; }
function deviceName() { return navigator.userAgent.includes("Mobile") ? "Mobile browser" : "Desktop browser"; }
function normaliseEndpoint(value: string) { const url = new URL(value); return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, "")}`; }
function wsEndpoint(endpoint: string, roomId: string) { const url = new URL(endpoint); url.protocol = url.protocol === "https:" ? "wss:" : "ws:"; url.pathname = `${url.pathname.replace(/\/$/, "")}/v1/rooms/${roomId}/sync`; return url.toString(); }
async function digest(bytes: Uint8Array) { const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", input))); }
function equal(left: string[], right: string[]) { return left.length === right.length && left.every((value, index) => value === right[index]); }

function parseConfig(code: string): CloudConfig {
  let value: unknown;
  try { value = JSON.parse(decoder.decode(fromBase64Url(code))); } catch { throw new Error("This cloud transfer code is invalid."); }
  if (!value || typeof value !== "object") throw new Error("This cloud transfer code is invalid.");
  const config = value as Partial<CloudConfig>;
  if (typeof config.endpoint !== "string" || typeof config.roomId !== "string" || typeof config.pairingToken !== "string" || typeof config.key !== "string" || typeof config.groupId !== "string") throw new Error("This cloud transfer code is incomplete.");
  return { endpoint: normaliseEndpoint(config.endpoint), roomId: config.roomId, pairingToken: config.pairingToken, key: config.key, groupId: config.groupId };
}

export class CloudTransferSession {
  private socket: WebSocket | null = null;
  private config: CloudConfig | null = null;
  private key: CryptoKey | null = null;
  private incoming: Incoming | null = null;
  private localHeads: string[] = [];
  private peerHeads: string[] | null = null;
  private gotDocument = false;
  private sentDocument = false;
  private stopped = false;
  private finished = false;
  private readonly deviceId = getDeviceId();

  constructor(private readonly repository: GroupSyncRepository, private readonly callbacks: CloudCallbacks) {}

  available() { return Boolean(import.meta.env.VITE_CLOUD_SYNC_URL); }

  async create(groupId: string) {
    const endpoint = import.meta.env.VITE_CLOUD_SYNC_URL;
    if (!endpoint) throw new Error("Cloud transfer is not configured for this deployment.");
    const snapshot = this.repository.getDocumentSnapshot(groupId);
    if (!snapshot) throw new Error("This group is no longer available on this device.");
    this.cancel();
    this.callbacks.onState({ status: "creating", detail: "Creating a temporary encrypted cloud room…", groupId });
    const response = await fetch(`${normaliseEndpoint(endpoint)}/v1/rooms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: this.deviceId, deviceName: deviceName() }) });
    if (!response.ok) throw new Error("The cloud relay could not create a temporary room.");
    const created = await response.json() as { credential?: string; roomId?: string };
    if (!created.credential || !created.roomId) throw new Error("The cloud relay did not return a room credential.");
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    this.config = { endpoint: normaliseEndpoint(endpoint), roomId: created.roomId, credential: created.credential, key: base64Url(rawKey), groupId };
    this.key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    this.localHeads = snapshot.heads;
    await this.connect();
    const pair = await fetch(`${this.config.endpoint}/v1/rooms/${this.config.roomId}/pair`, { method: "POST", headers: { Authorization: `Bearer ${this.config.credential}` } });
    if (!pair.ok) throw new Error("The cloud relay could not create a pairing code.");
    const pairing = await pair.json() as { pairingToken?: string };
    if (!pairing.pairingToken) throw new Error("The cloud relay returned an invalid pairing code.");
    this.callbacks.onState({ status: "awaiting-peer", detail: "Scan the cloud fallback QR on the other device.", groupId });
    return base64Url(encoder.encode(JSON.stringify({ endpoint: this.config.endpoint, roomId: this.config.roomId, pairingToken: pairing.pairingToken, key: this.config.key, groupId })));
  }

  async join(code: string) {
    this.cancel();
    this.config = parseConfig(code);
    this.key = await crypto.subtle.importKey("raw", fromBase64Url(this.config.key), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    this.localHeads = this.repository.getDocumentSnapshot(this.config.groupId)?.heads || [];
    this.callbacks.onState({ status: "awaiting-peer", detail: "Joining the encrypted cloud transfer…", groupId: this.config.groupId });
    await this.connect();
  }

  cancel = () => {
    this.stopped = true;
    this.socket?.close();
    this.socket = null;
    this.config = null;
    this.key = null;
    this.incoming = null;
    this.peerHeads = null;
    this.gotDocument = false;
    this.sentDocument = false;
    this.finished = false;
    this.stopped = false;
  };

  private async connect() {
    if (!this.config) throw new Error("No cloud room is configured.");
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(wsEndpoint(this.config!.endpoint, this.config!.roomId));
      this.socket = socket;
      const timer = window.setTimeout(() => reject(new Error("The cloud relay did not respond.")), 20_000);
      socket.addEventListener("open", () => this.sendPlain({ type: "authenticate", deviceId: this.deviceId, deviceName: deviceName(), credential: this.config!.credential, pairingToken: this.config!.pairingToken }));
      socket.addEventListener("message", event => { void this.receive(typeof event.data === "string" ? event.data : ""); });
      socket.addEventListener("error", () => reject(new Error("The cloud relay connection failed.")), { once: true });
      socket.addEventListener("close", () => { if (!this.finished && !this.stopped) this.fail("Cloud transfer closed before sync completed."); });
      const ready = () => { window.clearTimeout(timer); resolve(); };
      socket.addEventListener("message", event => { if (typeof event.data === "string" && event.data.includes('"authenticated"')) ready(); }, { once: true });
    });
  }

  private async receive(raw: string) {
    let outer: Record<string, unknown>;
    try { outer = JSON.parse(raw) as Record<string, unknown>; } catch { return; }
    if (outer.type === "authenticated" && typeof outer.credential === "string" && this.config) { this.config.credential = outer.credential; return; }
    if (outer.type === "peer-ready") return this.beginTransfer();
    if (outer.type === "peer-left") return this.fail("The other device left the cloud transfer.");
    if (outer.type === "error") return this.fail(typeof outer.message === "string" ? outer.message : "The cloud relay rejected the transfer.");
    if (outer.type !== "frame" || typeof outer.data !== "string") return;
    try { await this.receiveFrame(await this.decrypt(outer.data)); } catch { this.fail("The encrypted cloud frame could not be opened."); }
  }

  private async beginTransfer() {
    if (this.sentDocument || !this.config) return;
    this.callbacks.onState({ status: "transferring", detail: "Exchanging encrypted group changes through the temporary relay…", groupId: this.config.groupId });
    const snapshot = this.repository.getDocumentSnapshot(this.config.groupId);
    this.localHeads = snapshot?.heads || [];
    await this.sendFrame({ type: "hello", hasDocument: Boolean(snapshot), heads: this.localHeads });
    if (snapshot) await this.sendSnapshot(snapshot.data);
    else await this.sendFrame({ type: "heads", heads: this.localHeads });
  }

  private async sendSnapshot(data: Uint8Array) {
    if (data.byteLength > MAX_DOCUMENT_BYTES) throw new Error("This group is too large for cloud transfer.");
    this.sentDocument = true;
    const id = crypto.randomUUID();
    const chunks = Math.ceil(data.byteLength / CHUNK_BYTES);
    await this.sendFrame({ type: "snapshot-start", id, bytes: data.byteLength, chunks, hash: await digest(data) });
    for (let index = 0; index < chunks; index += 1) await this.sendFrame({ type: "snapshot-chunk", id, index, data: base64(data.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES)) });
    await this.sendFrame({ type: "snapshot-end", id });
  }

  private async receiveFrame(frame: Record<string, unknown>) {
    if (frame.type === "hello") {
      if (typeof frame.hasDocument !== "boolean" || !Array.isArray(frame.heads)) return this.fail("The cloud transfer handshake is invalid.");
      this.peerHeads = frame.heads.filter((head): head is string => typeof head === "string").sort();
      if (!frame.hasDocument) { this.gotDocument = true; await this.sendHeads(); }
      return;
    }
    if (frame.type === "snapshot-start") {
      if (typeof frame.id !== "string" || typeof frame.bytes !== "number" || typeof frame.chunks !== "number" || !Number.isInteger(frame.bytes) || !Number.isInteger(frame.chunks) || typeof frame.hash !== "string" || frame.bytes < 0 || frame.bytes > MAX_DOCUMENT_BYTES || frame.chunks < 0 || frame.chunks > 1024) return this.fail("The cloud group is too large.");
      this.incoming = { id: frame.id, bytes: frame.bytes, chunks: frame.chunks, hash: frame.hash, chunksByIndex: new Map() };
      return;
    }
    if (frame.type === "snapshot-chunk") {
      if (!this.incoming || frame.id !== this.incoming.id || typeof frame.index !== "number" || !Number.isInteger(frame.index) || typeof frame.data !== "string" || frame.index < 0 || frame.index >= this.incoming.chunks) return;
      this.incoming.chunksByIndex.set(frame.index, fromBase64(frame.data));
      return;
    }
    if (frame.type === "snapshot-end") {
      if (!this.incoming || frame.id !== this.incoming.id || this.incoming.chunksByIndex.size !== this.incoming.chunks) return this.fail("The cloud group transfer was incomplete.");
      const source = this.incoming;
      const bytes = new Uint8Array([...source.chunksByIndex.entries()].sort(([a], [b]) => a - b).reduce((sum, [, part]) => sum + part.byteLength, 0));
      let offset = 0; for (const [, part] of [...source.chunksByIndex.entries()].sort(([a], [b]) => a - b)) { bytes.set(part, offset); offset += part.byteLength; }
      this.incoming = null;
      if (bytes.byteLength !== source.bytes || await digest(bytes) !== source.hash) return this.fail("The cloud group did not pass its integrity check.");
      this.callbacks.onState({ status: "merging", detail: "Merging cloud changes safely…", groupId: this.config?.groupId });
      const merged = await this.repository.mergeRemoteDocument(bytes);
      this.localHeads = merged.heads;
      this.gotDocument = true;
      this.callbacks.onRemoteGroup(merged.group);
      await this.sendHeads();
      return;
    }
    if (frame.type === "heads" && Array.isArray(frame.heads)) { this.peerHeads = frame.heads.filter((head): head is string => typeof head === "string").sort(); this.completeIfReady(); }
  }

  private async sendHeads() {
    if (!this.config) return;
    this.localHeads = this.repository.getDocumentSnapshot(this.config.groupId)?.heads || [];
    await this.sendFrame({ type: "heads", heads: this.localHeads });
    this.completeIfReady();
  }

  private completeIfReady() {
    if (!this.gotDocument || !this.peerHeads || !equal(this.localHeads, this.peerHeads) || this.finished || !this.config) return;
    this.finished = true;
    this.callbacks.onState({ status: "complete", detail: "Encrypted cloud transfer complete.", groupId: this.config.groupId });
    window.setTimeout(() => this.cancel(), 1_000);
  }

  private async sendFrame(frame: Record<string, unknown>) { this.sendPlain({ type: "frame", data: await this.encrypt(frame) }); }
  private sendPlain(value: unknown) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(value)); }
  private async encrypt(value: Record<string, unknown>) { const iv = crypto.getRandomValues(new Uint8Array(12)); const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.key!, encoder.encode(JSON.stringify(value))); const result = new Uint8Array(iv.byteLength + cipher.byteLength); result.set(iv); result.set(new Uint8Array(cipher), iv.byteLength); return base64Url(result); }
  private async decrypt(value: string) { const bytes = fromBase64Url(value); if (bytes.byteLength < 13) throw new Error("short"); const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) }, this.key!, bytes.subarray(12)); return JSON.parse(decoder.decode(plain)) as Record<string, unknown>; }
  private fail(detail: string) { if (this.stopped || this.finished) return; this.callbacks.onState({ status: "failed", detail, groupId: this.config?.groupId }); this.cancel(); }
}

export function cloudPairingUrl(code: string) { return `${window.location.origin}${window.location.pathname}#cloud=${encodeURIComponent(code)}`; }
export function readCloudPairingFragment() { const code = new URLSearchParams(window.location.hash.slice(1)).get("cloud"); if (!code) return undefined; window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`); return code; }
