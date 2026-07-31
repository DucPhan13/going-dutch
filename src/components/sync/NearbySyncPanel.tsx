import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, QrCode, ScanLine, Smartphone, Wifi } from "lucide-react";
import { QRCodeSVG } from "@rc-component/qrcode";
import { useGroupContext } from "@/contexts/GroupContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nearbyPairingUrl } from "@/sync/nearby";
import { cloudPairingUrl } from "@/sync/cloud";

function pairingCode(value: string) {
  try {
    const url = new URL(value);
    return new URLSearchParams(url.hash.slice(1)).get("nearby") || value;
  } catch {
    return value.trim();
  }
}

export function NearbySyncPanel({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { acceptNearbyAnswer, cancelNearbySync, createNearbyOffer, nearbySync, cloudSync, cloudTransferAvailable, createCloudTransfer, cancelCloudTransfer } = useGroupContext();
  const [offer, setOffer] = useState<string>();
  const [answer, setAnswer] = useState("");
  const [copied, setCopied] = useState(false);
  const [cloudCode, setCloudCode] = useState<string>();

  const start = async () => {
    try {
      setOffer(await createNearbyOffer(groupId));
      setAnswer("");
      setCopied(false);
    } catch { cancelNearbySync(); }
  };
  const acceptAnswer = useCallback(async (value: string) => {
    const code = pairingCode(value);
    if (!code) return;
    try { await acceptNearbyAnswer(code); } catch { /* The sync state displays the failure. */ }
  }, [acceptNearbyAnswer]);
  const copy = async () => {
    if (!offer) return;
    await navigator.clipboard.writeText(nearbyPairingUrl(offer));
    setCopied(true);
  };
  const startCloud = async () => {
    try { setCloudCode(await createCloudTransfer(groupId)); } catch { cancelCloudTransfer(); }
  };
  const awaitingAnswer = Boolean(offer) && (nearbySync.status === "awaiting-answer" || nearbySync.status === "connecting");
  const active = nearbySync.status !== "idle" && nearbySync.status !== "complete" && nearbySync.status !== "failed";

  return (
    <section className="space-y-4 rounded-xl border border-border bg-muted/20 p-4" aria-live="polite">
      <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10"><Wifi className="h-5 w-5 text-emerald-400" /></div><div><h3 className="font-medium">Sync nearby</h3><p className="mt-1 text-sm text-muted-foreground">Transfer <span className="text-foreground">{groupName}</span> directly over the same Wi-Fi. Only the short pairing answer is temporarily relayed; group data stays peer-to-peer.</p></div></div>
      {!offer && !active && <Button type="button" onClick={() => void start()} className="app-button-primary w-full gap-2"><QrCode className="h-4 w-4" />Create nearby pairing QR</Button>}
      {offer && nearbySync.status === "awaiting-answer" && <div className="space-y-3"><div className="mx-auto w-fit rounded-2xl bg-white p-3"><QRCodeSVG value={nearbyPairingUrl(offer)} size={208} level="L" marginSize={3} bgColor="#ffffff" fgColor="#11181c" title="Scan to receive this Going Dutch group nearby" /></div><p className="text-center text-sm text-muted-foreground">Scan this code with the other device. It will show a six-digit answer that expires after 60 seconds.</p><Button type="button" variant="outline" onClick={() => void copy()} className="w-full gap-2">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Pairing link copied" : "Copy pairing link"}</Button><div className="border-t border-border pt-4"><div className="space-y-2"><Label htmlFor="nearby-answer-code">Enter its six-digit answer</Label><Input id="nearby-answer-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={answer} onChange={event => setAnswer(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={event => event.key === "Enter" && void acceptAnswer(answer)} placeholder="000000" className="text-center font-mono text-lg tracking-[0.35em]" /></div></div></div>}
      {active && !awaitingAnswer && <Alert><Loader2 className="h-4 w-4 animate-spin" /><AlertTitle>{nearbySync.status === "merging" ? "Merging changes" : "Sync in progress"}</AlertTitle><AlertDescription>{nearbySync.detail}</AlertDescription></Alert>}
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
  const [answer, setAnswer] = useState<string>();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!pendingNearbyOffer) return;
    void acceptNearbyOffer(pendingNearbyOffer).then(setAnswer).catch(clearPendingNearbyOffer);
  }, [acceptNearbyOffer, clearPendingNearbyOffer, pendingNearbyOffer]);
  if (!pendingNearbyOffer) return null;
  const close = () => { cancelNearbySync(); clearPendingNearbyOffer(); setAnswer(undefined); };
  const compactAnswer = Boolean(answer && /^\d{6}$/.test(answer));
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-background/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="nearby-receive-title"><div className="app-surface w-full max-w-md space-y-4 p-5 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10"><Smartphone className="h-5 w-5 text-emerald-400" /></div><div><h2 id="nearby-receive-title" className="text-lg font-semibold">Receive nearby sync</h2><p className="mt-1 text-sm text-muted-foreground">Show this answer to the first device within 60 seconds. Keep both browsers open until sync finishes.</p></div>{answer ? compactAnswer ? <><div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-5 font-mono text-4xl font-semibold tracking-[0.28em] text-emerald-300">{answer}</div><p className="text-sm text-muted-foreground">This answer expires in 60 seconds.</p></> : <div className="mx-auto w-fit rounded-2xl bg-white p-3"><QRCodeSVG value={answer} size={208} level="L" marginSize={3} bgColor="#ffffff" fgColor="#11181c" title="Scan this answer on the first Going Dutch device" /></div> : <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Preparing answer code…</div>}{answer && <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(answer).then(() => setCopied(true))} className="w-full gap-2">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Answer code copied" : "Copy answer code"}</Button>}{nearbySync.status === "transferring" || nearbySync.status === "merging" ? <Alert className="text-left"><Loader2 className="h-4 w-4 animate-spin" /><AlertTitle>Sync in progress</AlertTitle><AlertDescription>{nearbySync.detail}</AlertDescription></Alert> : null}{nearbySync.status === "complete" ? <Alert className="border-emerald-500/40 text-left"><Check className="h-4 w-4 text-emerald-400" /><AlertTitle>Group received</AlertTitle><AlertDescription>{nearbySync.detail}</AlertDescription></Alert> : null}<Button type="button" variant="ghost" onClick={close} className="w-full">Cancel</Button></div></div>;
}

export function IncomingCloudTransferDialog() {
  const { cancelCloudTransfer, clearPendingCloudPair, cloudSync, joinCloudTransfer, pendingCloudPair } = useGroupContext();
  useEffect(() => { if (pendingCloudPair) void joinCloudTransfer(pendingCloudPair).catch(clearPendingCloudPair); }, [clearPendingCloudPair, joinCloudTransfer, pendingCloudPair]);
  if (!pendingCloudPair) return null;
  const close = () => { cancelCloudTransfer(); clearPendingCloudPair(); };
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-background/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cloud-receive-title"><div className="app-surface w-full max-w-md space-y-4 p-5 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10"><Wifi className="h-5 w-5 text-sky-400" /></div><div><h2 id="cloud-receive-title" className="text-lg font-semibold">Join encrypted cloud transfer</h2><p className="mt-1 text-sm text-muted-foreground">Keep both browsers open. Cloudflare relays encrypted frames and does not store your group.</p></div>{cloudSync.status === "complete" ? <Alert className="border-emerald-500/40 text-left"><Check className="h-4 w-4 text-emerald-400" /><AlertTitle>Group received</AlertTitle><AlertDescription>{cloudSync.detail}</AlertDescription></Alert> : <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{cloudSync.detail}</div>}<Button type="button" variant="ghost" onClick={close} className="w-full">Cancel</Button></div></div>;
}
