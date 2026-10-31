import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Square, Trash2 } from 'lucide-react';

// Browsers differ: Chrome/Firefox record webm or ogg, Safari records mp4 (m4a).
const TYPES = [['audio/webm;codecs=opus', 'webm'], ['audio/webm', 'webm'], ['audio/ogg;codecs=opus', 'ogg'], ['audio/mp4', 'm4a']];
const pickType = () => (typeof MediaRecorder === 'undefined' ? null : TYPES.find(([t]) => MediaRecorder.isTypeSupported(t)) ?? ['', 'webm']);
const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const MAX_SECONDS = 300;
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Records a voice clip, lets you listen to it, then sends it as a normal attachment named voice-….webm */
export default function VoiceRecorder({ onSend, onCancel }) {
    const [phase, setPhase] = useState('starting');     // starting | recording | review | error
    const [secs, setSecs] = useState(0);
    const [error, setError] = useState('');
    const [clip, setClip] = useState(null);             // { file, url }
    const rec = useRef(null), stream = useRef(null), chunks = useRef([]), timer = useRef(null), cancelled = useRef(false);

    const stopStream = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };

    useEffect(() => {
        let alive = true;
        (async () => {
            const pick = pickType();
            if (!pick || !navigator.mediaDevices?.getUserMedia) { setError('Voice clips need a modern browser on https or localhost.'); setPhase('error'); return; }
            try {
                const s = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
                stream.current = s;
                const r = new MediaRecorder(s, pick[0] ? { mimeType: pick[0] } : undefined);
                rec.current = r; chunks.current = [];
                r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
                r.onstop = () => {
                    stopStream(); clearInterval(timer.current);
                    if (cancelled.current) return;
                    const type = r.mimeType || pick[0] || 'audio/webm';
                    const blob = new Blob(chunks.current, { type });
                    setClip({ file: new File([blob], `voice-${stamp()}.${pick[1]}`, { type }), url: URL.createObjectURL(blob) });
                    setPhase('review');
                };
                r.start();
                setPhase('recording');
                timer.current = setInterval(() => setSecs((n) => n + 1), 1000);
            } catch (e) {
                setError(e?.name === 'NotAllowedError' ? 'The microphone is blocked. Allow it in the address bar, then try again.' : 'Could not start the microphone.');
                setPhase('error');
            }
        })();
        return () => {
            alive = false; cancelled.current = true; clearInterval(timer.current);
            try { if (rec.current?.state === 'recording') rec.current.stop(); } catch { /* already stopped */ }
            stopStream();
        };
    }, []);

    useEffect(() => { if (!clip) return; return () => URL.revokeObjectURL(clip.url); }, [clip]);
    const stop = () => { try { rec.current?.stop(); } catch { /* ignore */ } };
    useEffect(() => { if (phase === 'recording' && secs >= MAX_SECONDS) stop(); }, [secs, phase]);

    if (phase === 'error') return (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#C81E51]/10 px-3 py-2 text-sm text-[#7f1233]">
            <span role="alert">{error}</span><button type="button" onClick={onCancel} className="font-semibold underline">Close</button>
        </div>
    );

    return (
        <div className="flex items-center gap-3 rounded-xl bg-[#12315F] px-3 py-2 text-[#F5EFE6]">
            <button type="button" onClick={onCancel} aria-label="Discard voice clip" title="Discard" className="rounded-full p-2 hover:bg-white/10"><Trash2 size={18} /></button>
            {phase === 'review' && clip ? (<>
                <audio controls src={clip.url} className="h-9 min-w-0 flex-1" />
                <button type="button" onClick={() => onSend(clip.file)} className="inline-flex items-center gap-2 rounded-lg bg-[#2EC4B6] px-4 py-2 text-sm font-bold text-[#0A1F44] hover:brightness-95"><Send size={15} /> Send</button>
            </>) : (<>
                <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" /></span>
                <span className="flex-1 text-sm" aria-live="polite">{phase === 'starting' ? 'Allow the microphone…' : `Recording ${clock(secs)}`}</span>
                <button type="button" onClick={stop} disabled={phase !== 'recording'} className="inline-flex items-center gap-2 rounded-lg bg-[#2EC4B6] px-4 py-2 text-sm font-bold text-[#0A1F44] disabled:opacity-50"><Square size={14} /> Stop</button>
            </>)}
        </div>
    );
}
