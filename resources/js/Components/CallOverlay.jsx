import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { accept, clearError, decline, end, toggleCamera, toggleMute, useCall } from '@/lib/callManager';

/** One person's picture or video. Voice-only people show their photo; video people show their camera. */
function Tile({ stream, name, avatar, local = false, showVideo }) {
  const el = useRef(null);
  useEffect(() => { if (el.current) el.current.srcObject = stream ?? null; }, [stream]);
  const hasVideo = showVideo && stream && stream.getVideoTracks().length > 0;
  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-800">
      {hasVideo
        ? <video ref={el} autoPlay playsInline muted={local} className={`h-full w-full object-cover ${local ? '-scale-x-100' : ''}`} />
        : <>
            <audio ref={el} autoPlay muted={local} />
            <div className="flex h-full flex-col items-center justify-center gap-1">
              {avatar ? <img src={avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="h-12 w-12 rounded-full bg-slate-600" />}
            </div>
          </>}
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs">{local ? 'You' : name}</span>
    </div>
  );
}

const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Shown on every page: the "someone is calling" card, the call window, and call error messages. */
export default function CallOverlay() {
  const c = useCall();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (c.status !== 'active') return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [c.status]);
  useEffect(() => { if (!c.error) return; const t = setTimeout(clearError, 7000); return () => clearTimeout(t); }, [c.error]);

  return (
    <>
      {c.error && c.status === 'idle' && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-[80] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          {c.error} <button onClick={clearError} className="ml-2 underline">OK</button>
        </div>
      )}

      {c.status === 'ringing' && c.incoming && (
        <div role="alertdialog" aria-label="Incoming call" className="fixed left-1/2 top-4 z-[80] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl bg-slate-900 p-5 text-center text-white shadow-2xl">
          <img src={c.incoming.from.avatar_url} alt="" className="mx-auto h-16 w-16 animate-pulse rounded-full object-cover ring-4 ring-white/20" />
          <p className="mt-3 text-lg font-semibold">{c.incoming.from.name}</p>
          <p className="text-sm text-slate-300">is calling you · {c.incoming.video ? 'Video call' : 'Voice call'}</p>
          <div className="mt-4 flex justify-center gap-4">
            <button onClick={decline} className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold hover:bg-red-500"><PhoneOff size={16} /> Decline</button>
            <button onClick={accept} className="flex items-center gap-2 rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold hover:bg-green-500">
              {c.incoming.video ? <Video size={16} /> : <Phone size={16} />} Accept
            </button>
          </div>
        </div>
      )}

      {(c.status === 'calling' || c.status === 'active') && (
        <div role="dialog" aria-label="Call" className="fixed bottom-4 right-4 z-[80] w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-slate-900 p-3 text-white shadow-2xl">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="truncate font-semibold">{c.status === 'calling' ? `Calling ${c.label}…` : c.label}</span>
            <span className="ml-2 shrink-0 text-xs text-slate-300">{c.status === 'active' ? `${c.video ? 'Video' : 'Voice'} · ${fmt(now - c.startedAt)}` : 'Ringing'}</span>
          </div>
          <div className={`grid gap-2 ${Object.keys(c.peers).length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {Object.entries(c.peers).map(([k, p]) => <Tile key={k} stream={p.stream} name={p.name} avatar={p.avatar_url} showVideo={c.video} />)}
            {c.status === 'calling' && Object.keys(c.peers).length === 0 && (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-800 text-sm text-slate-300">Waiting for an answer…</div>
            )}
          </div>
          {c.video && <div className="mt-2 w-1/3"><Tile stream={c.local} name="You" local showVideo /></div>}
          <div className="mt-3 flex justify-center gap-3">
            <button onClick={toggleMute} aria-label={c.muted ? 'Unmute' : 'Mute'} className={`rounded-full p-3 ${c.muted ? 'bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}>{c.muted ? <MicOff size={18} /> : <Mic size={18} />}</button>
            {c.video && <button onClick={toggleCamera} aria-label={c.camOff ? 'Turn camera on' : 'Turn camera off'} className={`rounded-full p-3 ${c.camOff ? 'bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}>{c.camOff ? <VideoOff size={18} /> : <Video size={18} />}</button>}
            <button onClick={() => end()} aria-label="End call" className="rounded-full bg-red-600 p-3 hover:bg-red-500"><PhoneOff size={18} /></button>
          </div>
        </div>
      )}
    </>
  );
}
