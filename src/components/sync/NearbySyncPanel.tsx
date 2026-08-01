import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Loader2, QrCode, ScanLine, Smartphone, Wifi } from "lucide-react";
import { QRCodeSVG } from "@rc-component/qrcode";
import { useGroupContext } from "@/contexts/GroupContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { nearbyPairingUrl } from "@/sync/nearby";
import { cloudPairingUrl } from "@/sync/cloud";

const SUCCESS_DISMISS_MS = 1_500;

interface SyncSupport {
  supported: boolean;
  missing: string[];
}

function checkSyncSupport(): SyncSupport {
  const missing = [
    !window.isSecureContext && "secure context (HTTPS)",
    !("indexedDB" in window) && "IndexedDB",
    !("crypto" in window) && "Web Crypto",
    !("RTCPeerConnection" in window) && "WebRTC",
  ].filter(Boolean) as string[];
  return { supported: missing.length === 0, missing };
}

interface NearbySyncPanelProps {
  groupId: string;
  groupName: string;
  onComplete?: () => void;
}

export function NearbySyncPanel({ groupId, groupName, onComplete }: NearbySyncPanelProps) {
  const { cancelNearbySync, createNearbyOffer, nearbySync, cloudSync, cloudTransferAvailable, createCloudTransfer, cancelCloudTransfer } = useGroupContext();
  const [offer, setOffer] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [cloudCode, setCloudCode] = useState<string>();
  const [syncSupport, setSyncSupport] = useState<SyncSupport | null>(null);

  useEffect(() => setSyncSupport(checkSyncSupport()), []);

  useEffect(() => {
    if (nearbySync.status !== "complete") return;
    const timer = window.setTimeout(() => {
      cancelNearbySync();
      setOffer(undefined);
      onComplete?.();
    }, SUCCESS_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [cancelNearbySync, nearbySync.status, onComplete]);

  const start = async () => {
    try {
      setOffer(await createNearbyOffer(groupId));
      setCopied(false);
    } catch { /* The sync state contains the user-facing error. */ }
  };
  const copy = async () => {
    if (!offer) return;
    await navigator.clipboard.writeText(nearbyPairingUrl(offer));
    setCopied(true);
  };
  const startCloud = async () => {
    try { setCloudCode(await createCloudTransfer(groupId)); } catch { cancelCloudTransfer(); }
  };
  const awaitingPeer = Boolean(offer) && (nearbySync.status === "awaiting-peer" || nearbySync.status === "connecting");
  const active = nearbySync.status !== "idle" && nearbySync.status !== "complete" && nearbySync.status !== "failed";

  return (
    <section className="space-y-4 rounded-xl border border-border bg-muted/20 p-4" aria-live="polite">
      <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10"><Wifi className="h-5 w-5 text-emerald-400" /></div><div><h3 className="font-medium">Sync nearby</h3><p className="mt-1 text-sm text-muted-foreground">Transfer <span className="text-foreground">{groupName}</span> directly over the same Wi-Fi. Cloudflare only coordinates the connection; group data stays peer-to-peer.</p></div></div>
      {syncSupport && !syncSupport.supported && <Alert className="border-amber-500/40"><AlertTriangle className="h-4 w-4 text-amber-400" /><AlertTitle>Nearby sync may not work in this browser</AlertTitle><AlertDescription>This browser is missing {syncSupport.missing.join(", ")}. Use encrypted Export and Import below to move or back up this group.</AlertDescription></Alert>}
      {!offer && !active && <Button type="button" onClick={() => void start()} disabled={syncSupport?.supported === false} className="app-button-primary w-full gap-2"><QrCode className="h-4 w-4" />Create nearby pairing QR</Button>}
      {offer && nearbySync.status === "awaiting-peer" && <div className="space-y-3"><div className="mx-auto w-fit rounded-2xl bg-white p-3"><QRCodeSVG value={nearbyPairingUrl(offer)} size={208} level="M" marginSize={3} bgColor="#ffffff" fgColor="#11181c" title="Scan to join this Going Dutch nearby sync" /></div><div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-4 text-center font-mono text-4xl font-semibold tracking-[0.28em] text-emerald-300">{offer}</div><p className="text-center text-sm text-muted-foreground">Scan the QR code or enter this six-digit code on the other device. It expires in 60 seconds.</p><Button type="button" variant="outline" onClick={() => void copy()} className="w-full gap-2">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Pairing link copied" : "Copy pairing link"}</Button></div>}
      {active && !awaitingPeer && <Alert><Loader2 className="h-4 w-4 animate-spin" /><AlertTitle>{nearbySync.status === "merging" ? "Merging changes" : "Sync in progress"}</AlertTitle><AlertDescription>{nearbySync.detail}</AlertDescription></Alert>}
      {nearbySync.status === "complete" && <Alert className="border-emerald-500/40"><Check className="h-4 w-4 text-emerald-400" /><AlertTitle>Nearby sync complete</AlertTitle><AlertDescription>{nearbySync.detail}</AlertDescription></Alert>}
      {nearbySync.status === "failed" && <Alert className="border-destructive/40"><AlertTitle>Nearby sync did not connect</AlertTitle><AlertDescription className="space-y-3"><p>{nearbySync.detail}</p><Button type="button" variant="outline" onClick={() => void start()} className="gap-2"><ScanLine className="h-4 w-4" />Try again</Button></AlertDescription></Alert>}
      {nearbySync.status === "failed" && cloudTransferAvailable && !cloudCode && <Button type="button" variant="outline" onClick={() => void startCloud()} className="w-full gap-2"><Wifi className="h-4 w-4" />Use encrypted cloud transfer instead</Button>}
      {cloudCode && <div className="space-y-3 rounded-xl border border-border bg-background/50 p-3"><p className="text-sm font-medium">Temporary encrypted cloud transfer</p><div className="mx-auto w-fit rounded-2xl bg-white p-3"><QRCodeSVG value={cloudPairingUrl(cloudCode)} size={208} level="M" marginSize={3} bgColor="#ffffff" fgColor="#11181c" title="Scan to join this temporary encrypted Going Dutch cloud transfer" /></div><p className="text-center text-sm text-muted-foreground">The cloud only relays encrypted data while both devices are open.</p>{cloudSync.status === "awaiting-peer" || cloudSync.status === "creating" ? <p className="flex justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{cloudSync.detail}</p> : null}{cloudSync.status === "complete" ? <p className="text-center text-sm text-emerald-400">{cloudSync.detail}</p> : null}<Button type="button" variant="ghost" onClick={() => { cancelCloudTransfer(); setCloudCode(undefined); }} className="w-full">Cancel cloud transfer</Button></div>}
      {active && <Button type="button" variant="ghost" onClick={cancelNearbySync} className="w-full text-muted-foreground">Cancel nearby sync</Button>}
    </section>
  );
}

export function IncomingNearbySyncDialog() {
  const { acceptNearbyOffer, cancelNearbySync, clearPendingNearbyOffer, nearbySync, pendingNearbyOffer } = useGroupContext();
  useEffect(() => {
    if (!pendingNearbyOffer) return;
    void acceptNearbyOffer(pendingNearbyOffer).catch(() => undefined);
  }, [acceptNearbyOffer, pendingNearbyOffer]);
  useEffect(() => {
    if (!pendingNearbyOffer || nearbySync.status !== "complete") return;
    const timer = window.setTimeout(() => {
      cancelNearbySync();
      clearPendingNearbyOffer();
    }, SUCCESS_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [cancelNearbySync, clearPendingNearbyOffer, nearbySync.status, pendingNearbyOffer]);
  if (!pendingNearbyOffer) return null;
  const close = () => { cancelNearbySync(); clearPendingNearbyOffer(); };
  const finished = nearbySync.status === "complete";
  const failed = nearbySync.status === "failed";
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-background/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="nearby-receive-title"><div className="app-surface w-full max-w-md space-y-4 p-5 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10"><Smartphone className="h-5 w-5 text-emerald-400" /></div><div><h2 id="nearby-receive-title" className="text-lg font-semibold">Join nearby sync</h2><p className="mt-1 text-sm text-muted-foreground">Joining code <span className="font-mono text-foreground">{pendingNearbyOffer}</span>. Keep both browsers open while the direct connection is made.</p></div>{finished ? <Alert className="border-emerald-500/40 text-left"><Check className="h-4 w-4 text-emerald-400" /><AlertTitle>Group received</AlertTitle><AlertDescription>{nearbySync.detail}</AlertDescription></Alert> : failed ? <Alert className="border-destructive/40 text-left"><AlertTitle>Nearby sync did not connect</AlertTitle><AlertDescription>{nearbySync.detail}</AlertDescription></Alert> : <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{nearbySync.detail}</div>}<Button type="button" variant={finished ? "default" : "ghost"} onClick={close} className="w-full">{finished ? "Done" : failed ? "Close" : "Cancel"}</Button></div></div>;
}

export function IncomingCloudTransferDialog() {
  const { cancelCloudTransfer, clearPendingCloudPair, cloudSync, joinCloudTransfer, pendingCloudPair } = useGroupContext();
  useEffect(() => { if (pendingCloudPair) void joinCloudTransfer(pendingCloudPair).catch(clearPendingCloudPair); }, [clearPendingCloudPair, joinCloudTransfer, pendingCloudPair]);
  if (!pendingCloudPair) return null;
  const close = () => { cancelCloudTransfer(); clearPendingCloudPair(); };
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-background/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cloud-receive-title"><div className="app-surface w-full max-w-md space-y-4 p-5 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10"><Wifi className="h-5 w-5 text-sky-400" /></div><div><h2 id="cloud-receive-title" className="text-lg font-semibold">Join encrypted cloud transfer</h2><p className="mt-1 text-sm text-muted-foreground">Keep both browsers open. Cloudflare relays encrypted frames and does not store your group.</p></div>{cloudSync.status === "complete" ? <Alert className="border-emerald-500/40 text-left"><Check className="h-4 w-4 text-emerald-400" /><AlertTitle>Group received</AlertTitle><AlertDescription>{cloudSync.detail}</AlertDescription></Alert> : <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{cloudSync.detail}</div>}<Button type="button" variant="ghost" onClick={close} className="w-full">Cancel</Button></div></div>;
}
