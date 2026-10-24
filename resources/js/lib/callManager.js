/**
 * Phase 3: voice and video calls (WebRTC through PeerJS).
 *
 * Everything lives in this one module, outside React, so a call keeps running while you move between pages,
 * and an incoming call can ring on ANY page. React reads it with the useCall() hook.
 *
 * Each user's address is namespaced by the app install to avoid collisions on PeerJS's shared cloud broker.
 * Group calls are one-to-many from whoever starts them (everybody sees the caller; best for up to ~5 people).
 *
 * Optional settings in .env (all start with VITE_):
 *   VITE_PEER_HOST / VITE_PEER_PORT / VITE_PEER_PATH / VITE_PEER_SECURE : your own PeerJS server (default = free PeerJS cloud)
 *   VITE_TURN_URL / VITE_TURN_USER / VITE_TURN_PASS : a TURN relay, needed when two people are on strict networks
 */
import { useSyncExternalStore } from 'react';
import Peer from 'peerjs';
import { router } from '@inertiajs/react';

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
  messages: [], reactions: [], raisedHands: {}, handRaised: false, remoteMedia: {}, screenPeers: {}, screenSharing: false, localDisplay: null, localPeerId: null, isHost: false,
  meeting: null,       // { id, title, groupId, host } when this call is a scheduled study session
});
let state = { ...fresh(), me: null, ready: false };
const listeners = new Set();
function set(patch) { state = { ...state, ...patch }; listeners.forEach((l) => l()); }
export const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const getState = () => state;
export const useCall = () => useSyncExternalStore(subscribe, getState);

let peer = null, calls = {}, pending = new Set(), incomingCall = null, localStream = null, screenStream = null, ringTimer = null;
let dataConnections = {}, reactionTimers = new Set(), seenPackets = new Set(), screenRelay = null;
let ringCtx = null, ringLoop = null;
let callAudioContext = null;
let callLog = null;      // which chat to leave a "call ended / missed" note in, e.g. { user_id } or { group_id }
let appNamespace = 'studyhub';
const key = (id) => `studyhub-${appNamespace}-user-${id}`;

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
function unlockCallAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  if (!callAudioContext || callAudioContext.state === 'closed') callAudioContext = new AudioContextClass();
  if (callAudioContext.state !== 'running') {
    callAudioContext.resume().catch((error) => console.warn('Could not activate call speaker detection', error));
  }
}
export function getCallAudioContext() {
  return callAudioContext;
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

function normalizeMessage(value) {
  if (!value || typeof value.id !== 'string' || typeof value.text !== 'string') return null;
  return {
    id: value.id.slice(0, 200),
    text: value.text.slice(0, 2000),
    from: typeof value.from === 'string' ? value.from.slice(0, 200) : '',
    name: typeof value.name === 'string' ? value.name.slice(0, 100) : 'Member',
    at: Number.isFinite(value.at) ? value.at : Date.now(),
  };
}

function attachDataConnection(conn) {
  const k = conn.peer;
  dataConnections[k] = conn;
  conn.on('open', () => {
    const queued = conn._studyHubQueue ?? [];
    conn._studyHubQueue = [];
    queued.forEach((message) => sendData(conn, k, message));
    sendData(conn, k, {
      type: 'sync',
      messages: state.messages.slice(-50),
      raised: state.handRaised,
      muted: state.muted,
      camOff: state.camOff,
      sharing: state.screenSharing || !!screenRelay,
    });
  });
  conn.on('data', (message) => {
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
    if (message.id && (typeof message.id !== 'string' || message.id.length > 200)) return;
    if (message.id && seenPackets.has(message.id)) return;
    if (message.id) rememberPacket(message.id);
    const from = conn.metadata?.from ?? state.peers[k] ?? {};
    const actor = typeof message.actor === 'string' && message.actor.length <= 200 ? message.actor : k;
    if (message.type === 'chat') {
      const entry = normalizeMessage(message.message);
      if (entry && !state.messages.some((current) => current.id === entry.id)) {
        set({ messages: [...state.messages.slice(-99), entry] });
        if (message.id) broadcast(message, k);
      }
    } else if (message.type === 'reaction' && typeof message.emoji === 'string' && message.emoji.length <= 8) {
      const name = typeof message.name === 'string' ? message.name.slice(0, 100) : (from.name ?? 'Member');
      const reaction = { id: `${Date.now()}-${Math.random()}`, emoji: message.emoji, from: actor, name };
      set({ reactions: [...state.reactions, reaction] });
      if (message.id) broadcast(message, k);
      const timer = setTimeout(() => {
        reactionTimers.delete(timer);
        set({ reactions: state.reactions.filter((item) => item.id !== reaction.id) });
      }, 4000);
      reactionTimers.add(timer);
    } else if (message.type === 'hand') {
      set({ raisedHands: { ...state.raisedHands, [actor]: !!message.raised } });
      if (message.id) broadcast(message, k);
    } else if (message.type === 'screen') {
      const relayPeer = typeof message.relayPeer === 'string' && message.relayPeer.length <= 200 ? message.relayPeer : actor;
      set({ screenPeers: { ...state.screenPeers, [relayPeer]: !!message.sharing } });
      if (state.isHost && actor !== peer?.id) relayParticipantScreen(k, !!message.sharing, actor);
    } else if (message.type === 'screen-denied') {
      set({ error: 'Someone else is already sharing their screen.' });
      stopScreenShare();
    } else if (message.type === 'media') {
      set({ remoteMedia: { ...state.remoteMedia, [actor]: { muted: !!message.muted, camOff: !!message.camOff } } });
      broadcast(message, k);
    } else if (message.type === 'sync') {
      const messages = Array.isArray(message.messages)
        ? message.messages.map(normalizeMessage).filter(Boolean).slice(-50)
        : [];
      const merged = [...state.messages];
      messages.forEach((entry) => { if (!merged.some((current) => current.id === entry.id)) merged.push(entry); });
      set({
        messages: merged.slice(-100),
        raisedHands: { ...state.raisedHands, [k]: !!message.raised },
        remoteMedia: { ...state.remoteMedia, [k]: { muted: !!message.muted, camOff: !!message.camOff } },
        screenPeers: { ...state.screenPeers, [k]: !!message.sharing },
      });
    }
  });
  conn.on('close', () => {
    if (dataConnections[k] === conn) delete dataConnections[k];
  });
  conn.on('error', (error) => {
    console.error('Call data connection failed', error);
    if (dataConnections[k] === conn) delete dataConnections[k];
  });
}

function ensureDataConnection(k) {
  if (!peer || !k || dataConnections[k] || peer.id.localeCompare(k) > 0) return;
  attachDataConnection(peer.connect(k, { reliable: true, metadata: { meetingData: true, from: state.me } }));
}

function rememberPacket(id) {
  seenPackets.add(id);
  if (seenPackets.size > 500) seenPackets.delete(seenPackets.values().next().value);
}

function sendData(conn, k, message) {
  try {
    if (conn.open) {
      conn.send(message);
    } else {
      const queued = conn._studyHubQueue ?? [];
      if (queued.length >= 100) {
        set({ error: 'Call messages are temporarily delayed while a participant reconnects.' });
        return;
      }
      conn._studyHubQueue = [...queued, message];
    }
  } catch (error) {
    console.error('Could not send call data', error);
    if (dataConnections[k] === conn) delete dataConnections[k];
    set({ error: 'Could not send call messages or controls to a participant.' });
  }
}

function broadcast(message, exceptKey = null) {
  const packet = message.id ? message : { ...message, id: `${peer?.id ?? 'call'}-${Date.now()}-${Math.random()}` };
  rememberPacket(packet.id);
  Object.keys(state.peers).forEach((k) => {
    if (k === exceptKey) return;
    ensureDataConnection(k);
    const conn = dataConnections[k];
    if (!conn) return;
    sendData(conn, k, packet);
  });
}

function sendToPeer(k, message) {
  ensureDataConnection(k);
  const conn = dataConnections[k];
  if (!conn) return;
  const packet = { ...message, id: message.id ?? `${peer?.id ?? 'call'}-${Date.now()}-${Math.random()}` };
  rememberPacket(packet.id);
  sendData(conn, k, packet);
}

async function relayParticipantScreen(sourceKey, sharing, actor) {
  if (!state.isHost) return;
  if (sharing) {
    const otherCalls = Object.entries(calls).filter(([k]) => k !== sourceKey && state.peers[k]);
    if (!otherCalls.length) return;
    if (screenStream || screenRelay) {
      sendToPeer(sourceKey, { type: 'screen-denied' });
      return;
    }
    const track = state.peers[sourceKey]?.stream?.getVideoTracks()[0];
    const senders = otherCalls.flatMap(([, call]) => call.peerConnection?.getSenders?.() ?? [])
      .filter((sender) => sender.track?.kind === 'video');
    if (!track || !senders.length) {
      sendToPeer(sourceKey, { type: 'screen-denied' });
      return;
    }
    try {
      await Promise.all(senders.map((sender) => sender.replaceTrack(track)));
      screenRelay = { sourceKey, track, senders, actor };
      broadcast({ type: 'screen', sharing: true, actor, relayPeer: peer?.id }, sourceKey);
    } catch (error) {
      console.error('Could not relay a participant screen share', error);
      await Promise.allSettled(senders.map((sender) => sender.replaceTrack(localStream?.getVideoTracks()[0] ?? null)));
      sendToPeer(sourceKey, { type: 'screen-denied' });
    }
    return;
  }
  if (!screenRelay || screenRelay.sourceKey !== sourceKey) return;
  const relayed = screenRelay;
  screenRelay = null;
  const restoreTrack = screenStream?.getVideoTracks()[0] ?? localStream?.getVideoTracks()[0] ?? null;
  const results = await Promise.allSettled(relayed.senders.map((sender) => sender.replaceTrack(restoreTrack)));
  if (results.some((result) => result.status === 'rejected')) console.error('Could not restore video after a participant stopped sharing', results);
  broadcast({ type: 'screen', sharing: false, actor, relayPeer: peer?.id }, sourceKey);
}

function showReaction(emoji) {
  const reaction = { id: `${Date.now()}-${Math.random()}`, emoji, from: peer?.id, name: state.me?.name ?? 'You' };
  set({ reactions: [...state.reactions, reaction] });
  const timer = setTimeout(() => {
    reactionTimers.delete(timer);
    set({ reactions: state.reactions.filter((item) => item.id !== reaction.id) });
  }, 4000);
  reactionTimers.add(timer);
  return reaction;
}

function connect(id) {
  const p = new Peer(id, peerOptions());
  peer = p;
  p.on('open', () => set({ ready: true, localPeerId: p.id }));
  p.on('call', onIncoming);
  p.on('connection', (conn) => {
    if (conn.metadata?.meetingData) attachDataConnection(conn);
    else onSignal(conn);
  });
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
export function init(user, namespace) {
  if (!user) return;
  if (namespace) appNamespace = namespace;
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
    if (screenRelay && state.isHost && k !== screenRelay.sourceKey) {
      const senders = call.peerConnection?.getSenders?.().filter((sender) => sender.track?.kind === 'video') ?? [];
      Promise.all(senders.map((sender) => sender.replaceTrack(screenRelay.track)))
        .then(() => { if (screenRelay) screenRelay.senders.push(...senders); })
        .catch((error) => console.error('Could not share the active screen with a newly joined participant', error));
    }
    ensureDataConnection(k);
  });
  const gone = () => {
    if (calls[k] !== call) return;
    delete calls[k]; pending.delete(k);
    const { [k]: _removedMedia, ...remainingMedia } = state.remoteMedia;
    set({ remoteMedia: remainingMedia });
    if (screenRelay?.sourceKey === k) relayParticipantScreen(k, false, screenRelay.actor);
    const { [k]: _removed, ...rest } = state.peers;
    set({ peers: rest });
    if (!Object.keys(calls).length && !pending.size && state.status !== 'idle') end();
  };
  call.on('close', gone); call.on('error', gone);
}

function cleanup() {
  clearTimeout(ringTimer); stopRing();
  Object.values(calls).forEach((c) => { try { c.close(); } catch { /* ignore */ } });
  Object.values(dataConnections).forEach((c) => { try { c.close(); } catch { /* ignore */ } });
  reactionTimers.forEach(clearTimeout);
  reactionTimers.clear();
  calls = {}; pending = new Set(); incomingCall = null;
  dataConnections = {};
  seenPackets.clear();
  screenRelay = null;
  const sharedScreen = screenStream;
  screenStream = null;
  sharedScreen?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
  localStream?.getTracks().forEach((t) => t.stop()); localStream = null;
}
/** Leaves a one-line note in the chat the call was started from (only the person who called writes it). */
function logCall(was, message, byUser) {
  const log = callLog; callLog = null;
  if (!log || (was !== 'calling' && was !== 'active')) return;
  const answered = was === 'active' && state.startedAt;
  const payload = { ...log, video: state.video, outcome: answered ? 'ended' : (byUser ? 'cancelled' : 'missed'),
    seconds: answered ? Math.round((Date.now() - state.startedAt) / 1000) : 0 };
  try { router.post(route('messages.call'), payload, { preserveScroll: true, preserveState: true, only: ['messages'], async: true }); } catch { /* the note is optional */ }
}
/** A scheduled study session counts as study time: log the minutes spent in the call to Progress automatically. */
function logStudy(was) {
  const m = state.meeting;
  if (!m || was !== 'active' || !state.startedAt) return;
  const minutes = Math.min(1440, Math.round((Date.now() - state.startedAt) / 60000));
  if (minutes < 1) return;
  try { router.post(route('progress.store'), { minutes, topic: m.title, study_group_id: m.groupId ?? '' }, { preserveScroll: true, preserveState: true, only: ['auth'], async: true }); } catch { /* optional */ }
}
export function end(message = null, byUser = false) {
  logCall(state.status, message, byUser);
  logStudy(state.status);
  if (state.status === 'calling') pending.forEach((k) => signal(k, 'cancelled'));
  cleanup();
  set({ ...fresh(), error: message });
}
export const clearError = () => set({ error: null });

/** targets = [{ id, name, avatar_url }]. Rings them all; the call becomes active when the first person answers. */
export async function startCall(targets, { video = false, log = null, meeting = null } = {}) {
  if (state.status !== 'idle') { set({ error: 'You are already in a call.' }); return false; }
  const list = (targets || []).filter((t) => t && t.id !== state.me?.id);
  if (!list.length) return false;
  if (!peer || !state.ready) { set({ error: 'Calling is not ready yet. Check your internet connection and try again.' }); return false; }
  unlockCallAudioContext();
  let stream;
  try { stream = await getMedia(video); } catch (e) { set({ error: mediaError(e) }); return false; }
  localStream = stream; callLog = log;
  set({ ...fresh(), status: 'calling', video: video && stream.getVideoTracks().length > 0,
    label: meeting ? meeting.title : list.map((t) => t.name).join(', '), local: stream, meeting, isHost: !meeting || !!meeting.host });
  list.forEach((t) => {
    const k = key(t.id); pending.add(k);
    wire(peer.call(k, stream, { metadata: { from: state.me, video: state.video, meeting: meeting ? { id: meeting.id, title: meeting.title, groupId: meeting.groupId } : null } }), k, { id: t.id, name: t.name, avatar_url: t.avatar_url });
  });
  ringTimer = setTimeout(() => { if (state.status === 'calling') end('No answer.'); }, 45000);
  return true;
}

function onIncoming(call) {
  const from = call.metadata?.from, video = !!call.metadata?.video, meeting = call.metadata?.meeting ?? null;
  // Someone pressing "Join" on the session we are hosting: let them in without ringing.
  if (from && meeting && state.meeting?.host && state.meeting.id === meeting.id && localStream && (state.status === 'calling' || state.status === 'active')) {
    call.answer(localStream);
    wire(call, call.peer, { id: from.id, name: from.name, avatar_url: from.avatar_url });
    return;
  }
  if (!from || state.status !== 'idle') { signal(call.peer, 'busy'); call.close(); return; }       // busy: the caller just sees it end
  incomingCall = call;
  set({ ...fresh(), status: 'ringing', video, label: from.name, incoming: { from, video, meeting } });
  startRing();
  ringTimer = setTimeout(() => { if (state.status === 'ringing') decline(); }, 45000);
  call.on('close', () => { if (incomingCall === call && state.status === 'ringing') end(`Missed call from ${from.name}.`); });
}

export async function accept() {
  const call = incomingCall;
  if (state.status !== 'ringing' || !call) return;
  const { from, video, meeting } = state.incoming;
  clearTimeout(ringTimer); stopRing();
  unlockCallAudioContext();
  let stream;
  try { stream = await getMedia(video); }
  catch (e) {
    try { if (!video) throw e; stream = await getMedia(false); }       // camera failed: join with voice only
    catch (e2) { decline(mediaError(e2)); return; }
  }
  localStream = stream;
  set({ status: 'active', local: stream, incoming: null, startedAt: Date.now(), label: meeting?.title ?? state.label, meeting: meeting ? { ...meeting, host: false } : null, video: video && stream.getVideoTracks().length > 0 });
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
  broadcast({ type: 'media', muted: next, camOff: state.camOff, actor: state.localPeerId ?? peer?.id });
}
export function toggleCamera() {
  const next = !state.camOff;
  localStream?.getVideoTracks().forEach((t) => { t.enabled = !next; });
  set({ camOff: next });
  broadcast({ type: 'media', muted: state.muted, camOff: next, actor: state.localPeerId ?? peer?.id });
}

export function sendCallMessage(text) {
  const body = text.trim();
  if (!body || state.status !== 'active') return false;
  const message = {
    id: `${peer?.id ?? 'call'}-${Date.now()}-${Math.random()}`,
    text: body.slice(0, 2000),
    from: peer?.id,
    name: state.me?.name ?? 'You',
    at: Date.now(),
  };
  set({ messages: [...state.messages.slice(-99), message] });
  broadcast({ type: 'chat', message });
  return true;
}

export function sendReaction(emoji) {
  if (state.status !== 'active') return;
  showReaction(emoji);
  broadcast({ type: 'reaction', emoji, actor: peer?.id, name: state.me?.name });
}

export function toggleRaiseHand() {
  if (state.status !== 'active') return;
  const raised = !state.handRaised;
  set({ handRaised: raised, raisedHands: { ...state.raisedHands, [state.localPeerId ?? peer?.id]: raised } });
  broadcast({ type: 'hand', raised, actor: peer?.id });
}

export async function toggleScreenShare() {
  if (state.status !== 'active' || !state.video) return;
  if (screenStream) {
    await stopScreenShare();
    return;
  }
  if (screenRelay) {
    set({ error: 'A participant is already sharing their screen.' });
    return;
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    set({ error: 'Screen sharing is not available in this browser. Try a recent version of Chrome or Edge over HTTPS or localhost.' });
    return;
  }
  let stream;
  let senders = [];
  const cameraTrack = localStream?.getVideoTracks()[0] ?? null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const track = stream.getVideoTracks()[0];
    senders = Object.values(calls).flatMap((call) => call.peerConnection?.getSenders?.() ?? [])
      .filter((sender) => sender.track?.kind === 'video');
    if (!track || !senders.length) throw new Error('The video connection is not ready to share your screen yet.');
    await Promise.all(senders.map((sender) => sender.replaceTrack(track)));
    screenStream = stream;
    track.onended = () => { stopScreenShare(); };
    set({ screenSharing: true, localDisplay: stream, error: null });
    broadcast({ type: 'screen', sharing: true, actor: peer?.id });
  } catch (error) {
    const rollback = await Promise.allSettled(senders.map((sender) => sender.replaceTrack(cameraTrack)));
    if (rollback.some((result) => result.status === 'rejected')) console.error('Could not restore the camera after screen sharing failed', rollback);
    stream?.getTracks().forEach((track) => track.stop());
    set({ error: error?.message || 'Could not start screen sharing.' });
  }
}

async function stopScreenShare() {
  const sharedScreen = screenStream;
  if (!sharedScreen) return;
  screenStream = null;
  const cameraTrack = localStream?.getVideoTracks()[0] ?? null;
  const senders = Object.values(calls).flatMap((call) => call.peerConnection?.getSenders?.() ?? [])
    .filter((sender) => sender.track?.kind === 'video');
  try {
    await Promise.all(senders.map((sender) => sender.replaceTrack(cameraTrack)));
  } catch (error) {
    set({ error: error?.message || 'Could not switch back to your camera.' });
  }
  sharedScreen.getTracks().forEach((track) => { track.onended = null; track.stop(); });
  if (state.status === 'active') {
    set({ screenSharing: false, localDisplay: null });
    broadcast({ type: 'screen', sharing: false, actor: peer?.id });
  }
}
