import { useEffect, useRef, useState } from 'react';
import { Hand, Maximize2, MessageSquare, Mic, MicOff, Minimize2, MonitorUp, Phone, PhoneOff, Send, Smile, Video, VideoOff, X } from 'lucide-react';
import { accept, clearError, decline, end, getCallAudioContext, sendCallMessage, sendReaction, toggleCamera, toggleMute, toggleRaiseHand, toggleScreenShare, useCall } from '@/lib/callManager';

function Tile({ stream, name, avatar, local = false, showVideo, cameraOff = false, muted = false, raisedHand = false, reaction = null, sharing = false, featured = false }) {
  const videoEl = useRef(null), audioEl = useRef(null);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (videoEl.current) videoEl.current.srcObject = stream ?? null;
    if (audioEl.current) audioEl.current.srcObject = stream ?? null;
  }, [stream]);
  useEffect(() => {
    if (!stream?.getAudioTracks().length) {
      setSpeaking(false);
      return;
    }
    const context = getCallAudioContext();
    let frame, source;
    if (!context || context.state === 'closed') return;
    try {
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let active = false;
      const measure = () => {
        analyser.getByteTimeDomainData(samples);
        const volume = Math.sqrt(samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length);
        const next = active ? volume > 0.012 : volume > 0.025;
        if (next !== active) {
          active = next;
          setSpeaking(next);
        }
        frame = requestAnimationFrame(measure);
      };
      const startMonitoring = () => {
        if (context.state !== 'running' && frame) {
          cancelAnimationFrame(frame);
          frame = null;
        }
        if (context.state === 'running' && !frame) frame = requestAnimationFrame(measure);
      };
      context.addEventListener('statechange', startMonitoring);
      startMonitoring();
      context.resume().then(startMonitoring).catch((error) => console.warn('Could not start speaker detection', error));
      return () => {
        context.removeEventListener('statechange', startMonitoring);
        cancelAnimationFrame(frame);
        source?.disconnect();
        setSpeaking(false);
      };
    } catch (error) {
      console.warn('Could not monitor call audio activity', error);
    }
  }, [stream]);
  const hasVideo = showVideo && !cameraOff && stream && stream.getVideoTracks().length > 0;
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${featured ? 'h-full min-h-0 aspect-auto rounded-none bg-transparent' : 'min-h-40 aspect-video rounded-xl bg-slate-800'}`}>
      {hasVideo
        ? <video ref={videoEl} autoPlay playsInline muted className={`h-full w-full object-contain ${local && !sharing ? '-scale-x-100' : ''}`} />
        : <div className="relative flex items-center justify-center rounded-full">
            {speaking && <>
              <span className="absolute -inset-3 animate-ping rounded-full border-2 border-sky-100/90" />
              <span className="absolute -inset-1 rounded-full ring-4 ring-sky-100 shadow-[0_0_30px_rgba(186,230,253,0.8)]" />
            </>}
            {avatar
              ? <img src={avatar} alt={`${name}'s profile`} className={`relative rounded-full object-cover ${featured ? 'h-36 w-36 md:h-48 md:w-48' : 'h-16 w-16'}`} />
              : <div className={`relative flex items-center justify-center rounded-full bg-slate-600 ${featured ? 'h-36 w-36 text-4xl md:h-48 md:w-48' : 'h-16 w-16'}`}>{name.slice(0, 1)}</div>}
          </div>}
      <audio ref={audioEl} autoPlay muted={local} className="hidden" />
      {reaction && <span className="absolute bottom-10 right-3 rounded-full bg-black/70 px-3 py-2 text-3xl" aria-label={`${name} reacted ${reaction}`}>{reaction}</span>}
      {raisedHand && <span className="absolute right-3 top-3 rounded-full bg-amber-400 p-2 text-slate-950" title={`${name} raised their hand`}><Hand size={18} /></span>}
      {sharing && <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs">Presenting screen</span>}
      {muted && <span className="absolute right-3 bottom-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs" aria-label={`${name} is muted`}><MicOff size={14} /> Muted</span>}
      {cameraOff && <span className="absolute left-3 top-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs" aria-label={`${name} camera is off`}><VideoOff size={14} /> Camera off</span>}
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs">{local ? 'You' : name}</span>
    </div>
  );
}

const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const reactions = ['👍', '❤️', '😂', '👏', '🎉'];

function ControlButton({ label, active = false, children, onClick, className = '', disabled = false }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`flex h-12 min-w-12 items-center justify-center gap-2 rounded-full px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-white hover:bg-slate-600'} ${className}`}>
      {children}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function CallOverlay() {
  const c = useCall();
  const [now, setNow] = useState(Date.now());
  const [minimized, setMinimized] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const messageList = useRef(null);
  const minimizedBox = useRef(null), dragOffset = useRef(null);
  const [minimizedPosition, setMinimizedPosition] = useState(null);
  const isRinging = c.status === 'ringing' && c.incoming;
  const hasCall = (c.status === 'calling' || c.status === 'active') && c.local;
  const peerEntries = Object.entries(c.peers);
  const soloVoiceCall = !c.video && peerEntries.length === 1;
  useEffect(() => { if (c.status !== 'active') return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [c.status]);
  useEffect(() => { setMinimized(false); setChatOpen(false); setDraft(''); setMinimizedPosition(null); }, [c.status]);
  useEffect(() => { messageList.current?.scrollTo(0, messageList.current.scrollHeight); }, [c.messages, chatOpen]);
  useEffect(() => { if (!c.error) return; const t = setTimeout(clearError, 7000); return () => clearTimeout(t); }, [c.error]);

  const startDragging = (event) => {
    if (event.target.closest('button, a, input') || !minimizedBox.current) return;
    const rect = minimizedBox.current.getBoundingClientRect();
    dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const drag = (event) => {
    if (!dragOffset.current || !minimizedBox.current) return;
    const rect = minimizedBox.current.getBoundingClientRect();
    setMinimizedPosition({
      x: Math.min(Math.max(0, event.clientX - dragOffset.current.x), Math.max(0, window.innerWidth - rect.width)),
      y: Math.min(Math.max(0, event.clientY - dragOffset.current.y), Math.max(0, window.innerHeight - rect.height)),
    });
  };
  const stopDragging = () => { dragOffset.current = null; };
  const minimizedStyle = minimizedPosition
    ? { left: minimizedPosition.x, top: minimizedPosition.y, right: 'auto', bottom: 'auto' }
    : undefined;

  const minimizeButton = (
    <button type="button" onClick={() => setMinimized(true)} aria-label="Minimize call" title="Minimize call" className="rounded-full p-2 text-slate-200 hover:bg-white/10">
      <Minimize2 size={20} />
    </button>
  );
  const restoreButton = (
    <button type="button" onClick={() => setMinimized(false)} aria-label="Restore full screen call" title="Restore full screen call" className="rounded-full p-2 text-slate-200 hover:bg-white/10">
      <Maximize2 size={20} />
    </button>
  );

  return (
    <>
      {c.error && (
        <div role="alert" className="fixed left-1/2 top-4 z-[100] flex w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 items-start justify-between gap-3 rounded-lg bg-red-700 px-4 py-3 text-sm text-white shadow-xl">
          {c.error}<button type="button" onClick={clearError} aria-label="Dismiss error"><X size={18} /></button>
        </div>
      )}

      {isRinging && minimized && (
        <div ref={minimizedBox} style={minimizedStyle} role="alertdialog" aria-label="Incoming call" className="fixed bottom-4 right-4 z-[80] w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-slate-900 p-4 text-white shadow-2xl">
          <div onPointerDown={startDragging} onPointerMove={drag} onPointerUp={stopDragging} onPointerCancel={stopDragging} title="Drag to move" className="mb-3 flex cursor-move touch-none select-none items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={c.incoming.from.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/20" />
              <div><p className="font-semibold">{c.incoming.from.name}</p><p className="text-sm text-slate-300">Incoming {c.incoming.video ? 'video' : 'voice'} call</p></div>
            </div>
            {restoreButton}
          </div>
          <div className="flex justify-center gap-3">
            <button type="button" onClick={decline} className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold"><PhoneOff size={16} /> Decline</button>
            <button type="button" onClick={accept} className="flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold">{c.incoming.video ? <Video size={16} /> : <Phone size={16} />} Accept</button>
          </div>
        </div>
      )}

      {isRinging && !minimized && (
        <div role="alertdialog" aria-label="Incoming call" className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-slate-950 p-5 text-center text-white">
          <div className="absolute right-4 top-4">{minimizeButton}</div>
          <img src={c.incoming.from.avatar_url} alt="" className="h-28 w-28 animate-pulse rounded-full object-cover ring-4 ring-white/20" />
          <p className="mt-6 text-3xl font-semibold">{c.incoming.from.name}</p>
          <p className="mt-2 text-slate-300">is calling you · {c.incoming.video ? 'Video call' : 'Voice call'}</p>
          <div className="mt-8 flex justify-center gap-5">
            <button type="button" onClick={decline} className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-semibold hover:bg-red-500"><PhoneOff size={18} /> Decline</button>
            <button type="button" onClick={accept} className="flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 font-semibold hover:bg-green-500">{c.incoming.video ? <Video size={18} /> : <Phone size={18} />} Accept</button>
          </div>
        </div>
      )}

      {hasCall && minimized && (
        <div ref={minimizedBox} style={minimizedStyle} role="dialog" aria-label="Minimized call" className="fixed bottom-4 right-4 z-[80] w-[min(24rem,calc(100vw-2rem))] rounded-2xl bg-slate-900 p-3 text-white shadow-2xl">
          <div onPointerDown={startDragging} onPointerMove={drag} onPointerUp={stopDragging} onPointerCancel={stopDragging} title="Drag to move" className="mb-2 flex cursor-move touch-none select-none items-center justify-between gap-3">
            <div className="min-w-0"><p className="truncate font-semibold">{c.status === 'calling' ? `Calling ${c.label}…` : c.label}</p><p className="text-xs text-slate-300">{c.status === 'active' ? `${c.video ? 'Video' : 'Voice'} · ${fmt(now - c.startedAt)}` : 'Ringing'}</p></div>
            {restoreButton}
          </div>
          {c.video && <Tile stream={c.localDisplay ?? c.local} name="You" avatar={c.me?.avatar_url} local showVideo cameraOff={c.camOff && !c.screenSharing} muted={c.muted} raisedHand={c.handRaised} sharing={c.screenSharing} />}
          <div className="mt-3 flex justify-center gap-3">
            <ControlButton label={c.muted ? 'Unmute' : 'Mute'} active={c.muted} onClick={toggleMute}>{c.muted ? <MicOff size={18} /> : <Mic size={18} />}</ControlButton>
            <button type="button" onClick={() => end(null, true)} aria-label="End call" title="End call" className="rounded-full bg-red-600 p-3 hover:bg-red-500"><PhoneOff size={18} /></button>
          </div>
        </div>
      )}

      {hasCall && !minimized && (
        <div role="dialog" aria-label="Call" className="fixed inset-0 z-[80] flex flex-col bg-slate-950 text-white">
          <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 md:px-6">
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{c.status === 'calling' ? `Calling ${c.label}…` : c.label}</h2>
              <p className="text-xs text-slate-300">{c.status === 'active' ? `${c.video ? 'Video' : 'Voice'} call · ${fmt(now - c.startedAt)}` : 'Waiting for an answer…'}</p>
            </div>
            {minimizeButton}
          </header>
          <main className="relative flex min-h-0 flex-1 gap-3 overflow-hidden p-3 md:gap-4 md:p-5">
            <div className="pointer-events-none absolute left-1/2 top-4 z-[1] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
              {c.muted && (
                <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white"><MicOff size={15} className="mr-1 inline" /> You are muted</span>
              )}
              {c.handRaised && (
                <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-semibold text-slate-950"><Hand size={15} className="mr-1 inline" /> You raised your hand</span>
              )}
              {Object.entries(c.raisedHands).some(([id, raised]) => raised && id !== c.localPeerId) && (
                <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-semibold text-slate-950"><Hand size={15} className="mr-1 inline" /> A participant raised their hand</span>
              )}
              {c.reactions.slice(-3).map((reaction) => <span key={reaction.id} className="rounded-full bg-black/70 px-3 py-1 text-sm">{reaction.name}: {reaction.emoji}</span>)}
            </div>
            <div className={`grid min-h-0 flex-1 overflow-y-auto ${soloVoiceCall ? 'grid-cols-1 grid-rows-[minmax(0,1fr)]' : `content-center gap-3 ${c.video ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}`}>
              {peerEntries.map(([k, p]) => (
                <Tile key={k} stream={p.stream} name={p.name} avatar={p.avatar_url} showVideo={c.video}
                  cameraOff={!!c.remoteMedia[k]?.camOff && !c.screenPeers[k]} muted={!!c.remoteMedia[k]?.muted}
                  raisedHand={!!c.raisedHands[k]} reaction={c.reactions.findLast((r) => r.from === k)?.emoji} sharing={!!c.screenPeers[k]} featured={soloVoiceCall} />
              ))}
              {c.video && c.local && <Tile stream={c.localDisplay ?? c.local} name="You" avatar={c.me?.avatar_url} local showVideo cameraOff={c.camOff && !c.screenSharing} muted={c.muted} raisedHand={c.handRaised} reaction={c.reactions.findLast((r) => r.from === c.localPeerId)?.emoji} sharing={c.screenSharing} />}
              {c.status === 'calling' && Object.keys(c.peers).length === 0 && (
                <div className="flex aspect-video items-center justify-center rounded-xl bg-slate-800 text-slate-300">Waiting for an answer…</div>
              )}
              {!c.video && c.status === 'active' && Object.keys(c.peers).length === 0 && (
                <div className="flex aspect-video items-center justify-center rounded-xl bg-slate-800 text-slate-300">Connecting audio…</div>
              )}
            </div>
            {chatOpen && (
              <aside className="absolute inset-x-3 bottom-3 top-3 z-10 flex min-h-0 flex-col rounded-xl bg-white text-slate-900 shadow-2xl lg:static lg:w-80 lg:shrink-0">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h3 className="font-semibold">In-call messages</h3>
                  <button type="button" onClick={() => setChatOpen(false)} aria-label="Close call chat" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
                </div>
                <div ref={messageList} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
                  {c.messages.length === 0 && <p className="my-auto text-center text-sm text-slate-500">Messages are only visible during this call.</p>}
                  {c.messages.map((message) => (
                    <div key={message.id} className="rounded-lg bg-slate-100 px-3 py-2">
                      <div className="flex justify-between gap-3 text-xs text-slate-500"><b className="truncate">{message.name}</b><time>{new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.text}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); if (sendCallMessage(draft)) setDraft(''); }} className="flex gap-2 border-t border-slate-200 p-3">
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} aria-label="In-call message" placeholder="Send a message…" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <button type="submit" disabled={!draft.trim()} aria-label="Send message" className="rounded-lg bg-hunter-700 p-2 text-white disabled:opacity-40"><Send size={18} /></button>
                </form>
              </aside>
            )}
          </main>
          <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-3 py-4 md:gap-3">
            <ControlButton label={c.muted ? 'Unmute' : 'Mute'} active={c.muted} onClick={toggleMute}>{c.muted ? <MicOff size={18} /> : <Mic size={18} />}</ControlButton>
            {c.video && <ControlButton label={c.camOff ? 'Turn camera on' : 'Turn camera off'} active={c.camOff} onClick={toggleCamera}>{c.camOff ? <VideoOff size={18} /> : <Video size={18} />}</ControlButton>}
            {c.video && <ControlButton label={c.handRaised ? 'Lower hand' : 'Raise hand'} active={c.handRaised} onClick={toggleRaiseHand} disabled={c.status !== 'active'}><Hand size={18} /></ControlButton>}
            {c.video && <ControlButton label={c.screenSharing ? 'Stop sharing' : 'Share screen'} active={c.screenSharing} onClick={toggleScreenShare} disabled={c.status !== 'active'}><MonitorUp size={18} /></ControlButton>}
            {c.video && (
              <div className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1" aria-label="Send reaction">
                <Smile size={17} className="text-slate-300" />
                {reactions.map((emoji) => <button key={emoji} type="button" onClick={() => sendReaction(emoji)} disabled={c.status !== 'active'} aria-label={`React ${emoji}`} title={`React ${emoji}`} className="rounded-full p-1.5 text-lg hover:bg-slate-700 disabled:opacity-40">{emoji}</button>)}
              </div>
            )}
            <ControlButton label={chatOpen ? 'Hide chat' : 'Chat'} active={chatOpen} onClick={() => setChatOpen(!chatOpen)} disabled={c.status !== 'active'}><MessageSquare size={18} /></ControlButton>
            <button type="button" onClick={() => end(null, true)} aria-label="End call" title="End call" className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-5 font-semibold hover:bg-red-500"><PhoneOff size={18} /><span className="hidden sm:inline">End call</span></button>
          </footer>
        </div>
      )}
    </>
  );
}
