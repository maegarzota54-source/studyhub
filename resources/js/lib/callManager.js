/**
 * Phase 3: voice and video calls (WebRTC through PeerJS).
 *
 * Everything lives in this one module, outside React, so a call keeps running while you move between pages,
 * and an incoming call can ring on ANY page. React reads it with the useCall() hook.
 *
 * Each user's address is "studyhub-user-{id}". Group calls are one-to-many from whoever starts them
 * (everybody sees the caller; best for up to ~5 people).
 *
 * Optional settings in .env (all start with VITE_):
 *   VITE_PEER_HOST / VITE_PEER_PORT / VITE_PEER_PATH / VITE_PEER_SECURE : your own PeerJS server (default = free PeerJS cloud)
 *   VITE_TURN_URL / VITE_TURN_USER / VITE_TURN_PASS : a TURN relay, needed when two people are on strict networks
 */
import { useSyncExternalStore } from 'react';
import Peer from 'peerjs';

const env = import.meta.env ?? {};
function peerOptions() {
  const o = {};
  if (env.VITE_PEER_HOST) Object.assign(o, { host: env.VITE_PEER_HOST, port: Number(env.VITE_PEER_PORT || 9000), path: env.VITE_PEER_PATH || '/', secure: env.VITE_PEER_SECURE === 'true' });
  if (env.VITE_TURN_URL) o.config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: env.VITE_TURN_URL, username: env.VITE_TURN_USER, credential: env.VITE_TURN_PASS }] };
  return Object.assign(o, globalThis.__PEER_OPTS ?? {});   // __PEER_OPTS is only used by automated tests
}

const fresh = () => ({
  status: 'idle',      // idle | calling (we dial) | ringing (someone dials us) | active
  video: false, label: '', incoming: null, peers: {}, local: null,
  muted: false, camOff: false, startedAt: null, error: null,
});
let state = { ...fresh(), me: null, ready: false };
const listeners = new Set();
function set(patch) { state = { ...state, ...patch }; listeners.forEach((l) => l()); }
export const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const getState = () => state;
export const useCall = () => useSyncExternalStore(subscribe, getState);

let peer = null, calls = {}, pending = new Set(), incomingCall = null, localStream = null, ringTimer = null;
let ringCtx = null, ringLoop = null;
const key = (id) => `studyhub-user-${id}`;

/* ---------- ringing sound (generated, no audio file needed) ---------- */
function startRing() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ringCtx = new Ctx();
    const beep = () => [0, 0.35].forEach((t) => {
      const o = ringCtx.createOscillator(), g = ringCtx.createGain();
      o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(ringCtx.destination);
      o.start(ringCtx.currentTime + t); o.stop(ringCtx.currentTime + t + 0.2);
    });
    beep(); ringLoop = setInterval(beep, 2000);
  } catch { /* sound is optional */ }
}
function stopRing() {
  clearInterval(ringLoop); ringLoop = null;
  try { ringCtx?.close(); } catch { /* ignore */ }
  ringCtx = null;
}

/* ---------- camera and microphone ---------- */
async function getMedia(video) {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
  return navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { width: { ideal: 640 }, height: { ideal: 480 } } : false });
}
function mediaError(e) {
  switch (e?.name) {
    case 'NotAllowedError': return 'Microphone or camera is blocked. Click the lock icon in the address bar, allow it, then try again.';
    case 'NotFoundError': return 'No microphone or camera was found on this device.';
    case 'NotReadableError': return 'Your microphone or camera is being used by another app.';
    case 'InsecureContext': return 'Calls only work on https or on localhost.';
    default: return e?.message || 'Could not start the microphone or camera.';
  }
}

/* ---------- peer connection ---------- */
/** Tiny signalling message ("busy", "declined", "cancelled"): PeerJS can't tell the other side about a call that was never answered. */
function signal(toKey, ctl) {
  try { if (peer && toKey) { const c = peer.connect(toKey, { metadata: { ctl, from: state.me?.id } }); setTimeout(() => { try { c.close(); } catch { /* ignore */ } }, 3000); } } catch { /* ignore */ }
}
function onSignal(conn) {
  const ctl = conn.metadata?.ctl; if (!ctl) return;
  const k = conn.peer;
  if (ctl === 'cancelled') {
    if (state.status === 'ringing' && incomingCall?.peer === k) end(`Missed call from ${state.incoming?.from?.name ?? 'someone'}.`);
    return;
  }
  // busy / declined, sent by someone we are calling
  if (state.status === 'calling' && (pending.has(k) || calls[k])) {
    const name = state.peers[k]?.name || state.label;
    try { calls[k]?.close(); } catch { /* ignore */ }
    delete calls[k]; pending.delete(k);
    if (!pending.size && !Object.keys(calls).length) end(ctl === 'busy' ? `${name} is on another call.` : `${name} declined the call.`);
  }
}

function connect(id) {
  const p = new Peer(id, peerOptions());
  peer = p;
  p.on('open', () => set({ ready: true }));
  p.on('call', onIncoming);
  p.on('connection', onSignal);
  p.on('disconnected', () => { set({ ready: false }); setTimeout(() => { if (peer === p && !p.destroyed) p.reconnect(); }, 2000); });
  p.on('error', (err) => {
    if (err.type === 'unavailable-id') {            // same account open in another tab: this tab can call out but not receive
      p.destroy(); connect(`${key(state.me.id)}-${Math.random().toString(36).slice(2, 7)}`); return;
    }
    if (err.type === 'peer-unavailable') {
      const m = /studyhub-user-(\d+)/.exec(err.message || ''); const k = m ? key(m[1]) : null;
      if (k) { pending.delete(k); delete calls[k]; }
      if (state.status === 'calling' && pending.size === 0 && Object.keys(calls).length === 0) end('They are not available right now.');
      return;
    }
    if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) set({ ready: false });
  });
}

/** Call once with the logged-in user. Safe to call again on every page. */
export function init(user) {
  if (!user) return;
  if (peer && state.me?.id === user.id) return;
  if (peer) { peer.destroy(); peer = null; cleanup(); }
  set({ ...fresh(), me: { id: user.id, name: user.name, avatar_url: user.avatar_url }, ready: false });
  connect(key(user.id));
}

function wire(call, k, info) {
  calls[k] = call;
  call.on('stream', (stream) => {
    pending.delete(k); clearTimeout(ringTimer);
    set({ status: 'active', startedAt: state.startedAt ?? Date.now(), peers: { ...state.peers, [k]: { ...info, stream } } });
  });
  const gone = () => {
    if (calls[k] !== call) return;
    delete calls[k]; pending.delete(k);
    const { [k]: _removed, ...rest } = state.peers;
    set({ peers: rest });
    if (!Object.keys(calls).length && !pending.size && state.status !== 'idle') end();
  };
  call.on('close', gone); call.on('error', gone);
}

function cleanup() {
  clearTimeout(ringTimer); stopRing();
  Object.values(calls).forEach((c) => { try { c.close(); } catch { /* ignore */ } });
  calls = {}; pending = new Set(); incomingCall = null;
  localStream?.getTracks().forEach((t) => t.stop()); localStream = null;
}
export function end(message = null) {
  if (state.status === 'calling') pending.forEach((k) => signal(k, 'cancelled'));
  cleanup();
  set({ ...fresh(), error: message });
}
export const clearError = () => set({ error: null });

/** targets = [{ id, name, avatar_url }]. Rings them all; the call becomes active when the first person answers. */
export async function startCall(targets, { video = false } = {}) {
  if (state.status !== 'idle') { set({ error: 'You are already in a call.' }); return false; }
  const list = (targets || []).filter((t) => t && t.id !== state.me?.id);
  if (!list.length) return false;
  if (!peer || !state.ready) { set({ error: 'Calling is not ready yet. Check your internet connection and try again.' }); return false; }
  let stream;
  try { stream = await getMedia(video); } catch (e) { set({ error: mediaError(e) }); return false; }
  localStream = stream;
  set({ ...fresh(), status: 'calling', video: video && stream.getVideoTracks().length > 0,
    label: list.map((t) => t.name).join(', '), local: stream });
  list.forEach((t) => {
    const k = key(t.id); pending.add(k);
    wire(peer.call(k, stream, { metadata: { from: state.me, video: state.video } }), k, { id: t.id, name: t.name, avatar_url: t.avatar_url });
  });
  ringTimer = setTimeout(() => { if (state.status === 'calling') end('No answer.'); }, 45000);
  return true;
}

function onIncoming(call) {
  const from = call.metadata?.from, video = !!call.metadata?.video;
  if (!from || state.status !== 'idle') { signal(call.peer, 'busy'); call.close(); return; }       // busy: the caller just sees it end
  incomingCall = call;
  set({ ...fresh(), status: 'ringing', video, label: from.name, incoming: { from, video } });
  startRing();
  ringTimer = setTimeout(() => { if (state.status === 'ringing') decline(); }, 45000);
  call.on('close', () => { if (incomingCall === call && state.status === 'ringing') end(`Missed call from ${from.name}.`); });
}

export async function accept() {
  const call = incomingCall;
  if (state.status !== 'ringing' || !call) return;
  const { from, video } = state.incoming;
  clearTimeout(ringTimer); stopRing();
  let stream;
  try { stream = await getMedia(video); }
  catch (e) {
    try { if (!video) throw e; stream = await getMedia(false); }       // camera failed: join with voice only
    catch (e2) { decline(mediaError(e2)); return; }
  }
  localStream = stream;
  set({ status: 'active', local: stream, incoming: null, startedAt: Date.now(), video: video && stream.getVideoTracks().length > 0 });
  const k = call.peer;
  wire(call, k, { id: from.id, name: from.name, avatar_url: from.avatar_url });
  call.answer(stream);
}

export function decline(message = null) {
  if (incomingCall) signal(incomingCall.peer, 'declined');
  try { incomingCall?.close(); } catch { /* ignore */ }
  end(message);
}

export function toggleMute() {
  const next = !state.muted;
  localStream?.getAudioTracks().forEach((t) => { t.enabled = !next; });
  set({ muted: next });
}
export function toggleCamera() {
  const next = !state.camOff;
  localStream?.getVideoTracks().forEach((t) => { t.enabled = !next; });
  set({ camOff: next });
}
