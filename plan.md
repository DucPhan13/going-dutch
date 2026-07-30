# Going Dutch manual device sync

## Product decision

Going Dutch synchronizes one selected group while both devices are open:

1. **Nearby sync** uses a direct WebRTC data channel on the same Wi-Fi, with no account, server, or internet connection.
2. **Cloud transfer** is a manual fallback when nearby WebRTC cannot connect. A separate Cloudflare Worker relays end-to-end encrypted frames for one temporary two-device room and retains no group payload.
3. **Encrypted export/import** remains the backup and recovery path.

There is no continuous or background synchronization in this release.

## Nearby flow

- The sender opens a group’s **Sync** dialog and creates an offer QR code.
- The receiving device scans it, opens the PWA, and displays an answer QR code.
- The sender scans or pastes the answer code.
- Both browsers exchange one Automerge document, validate and merge it locally, then confirm matching heads before closing the connection.

Pairing descriptions live in URL fragments, direct transport uses `RTCPeerConnection({ iceServers: [] })`, and the WebRTC data channel is encrypted by DTLS. QR scanning uses the browser API when available; copy/paste remains the compatibility fallback.

## Cloud fallback

- The sender explicitly chooses **Use encrypted cloud transfer instead** after nearby sync fails.
- The browser creates a random temporary room and a client-only AES-GCM key, then shows a one-scan QR code.
- The Worker stores only the 24-hour room expiry and hashed pairing/device credentials in a Durable Object.
- A room admits two devices, pairing tokens last five minutes, and the Durable Object closes sockets and deletes metadata at expiry.
- The Worker validates origin, size, and authentication but only broadcasts ciphertext; it never stores, logs, or decrypts group data.

## Verification gate

- Same-LAN Chrome/Edge desktop to Chrome Android and Safari iOS works with internet disabled.
- A missing group is added, divergent edits merge, and both peers converge to identical Automerge heads.
- Camera denial, malformed QR, corrupt chunks, disconnected Wi-Fi, and invalid pairing links preserve local data and show a recovery path.
- Cloud fallback succeeds when direct WebRTC fails, rejects a third device, and expires cleanly.
