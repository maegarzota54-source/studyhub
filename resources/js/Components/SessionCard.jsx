import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { CheckCircle2, Lock, Phone, Radio, RotateCcw, Video } from 'lucide-react';
import { startCall, useCall } from '@/lib/callManager';

/** The server stores the time exactly as typed (no zone), so read it back as the same wall-clock time. */
export const wallClock = (iso) => new Date(String(iso).replace(/(\.\d+)?Z$/, ''));
const DEFAULT_MINUTES = 120;   // a session with no end time counts as live for 2 hours

export function sessionStatus(e, now = new Date()) {
  if (e.completed_at) return 'completed';   // the host (or a circle admin) closed the session
  const start = wallClock(e.starts_at);
  const end = e.ends_at ? wallClock(e.ends_at) : new Date(start.getTime() + DEFAULT_MINUTES * 60000);
  return now < start ? 'upcoming' : now < end ? 'live' : 'ended';
}

const span = (ms) => {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
};

/**
 * One study session. Grey and locked until its start time; then it opens and people can join.
 * Joining = a call: the host starts it (rings everyone invited who is online), everyone else presses Join.
 * Time spent in the call is logged to Progress automatically (see callManager).
 *   people = circle members { id, name, avatar_url } used to find who can be called
 */
export default function SessionCard({ event: e, people = [], me }) {
  const c = useCall();
  const [now, setNow] = useState(new Date());
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => { const f = () => tick((n) => n + 1); window.addEventListener('presence', f); return () => window.removeEventListener('presence', f); }, []);

  const status = sessionStatus(e, now);
  const start = wallClock(e.starts_at);
  const end = e.ends_at ? wallClock(e.ends_at) : new Date(start.getTime() + DEFAULT_MINUTES * 60000);
  const isHost = e.user_id === me.id;
  const host = e.user ?? people.find((p) => p.id === e.user_id) ?? { id: e.user_id, name: 'the host' };
  const invited = e.visibility === 'public' ? people : e.visibility === 'specific' ? (e.attendees ?? []) : [];
  const online = (p) => p.id !== me.id && window.__online?.has(p.id);
  const targets = (isHost ? invited : [host]).filter(online).map((p) => people.find((x) => x.id === p.id) ?? p);
  const solo = e.visibility === 'private' || (isHost && invited.filter((p) => p.id !== me.id).length === 0);

  const go = (video) => startCall(targets, {
    video, log: isHost && e.study_group_id ? { group_id: e.study_group_id } : null,
    meeting: { id: e.id, title: e.title, groupId: e.study_group_id, host: isHost },
  });
  const busy = c.status !== 'idle';
  const can = status === 'live' && !busy && c.ready && targets.length > 0;
  const why = busy ? 'You are already in a call' : !c.ready ? 'Connecting…' : targets.length === 0 ? (isHost ? 'Nobody invited is online yet' : `${host.name} is not online yet`) : '';

  const tone = status === 'upcoming' ? 'border-gray-200 bg-gray-100 text-gray-400'
    : status === 'live' ? 'border-green-500 bg-green-50' : status === 'completed' ? 'border-hunter-500/40 bg-hunter-50' : 'border-gray-200 bg-white opacity-60';
  const toggleDone = () => router.patch(route('schedule.complete', e.id), {}, { preserveScroll: true });
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate font-semibold ${status === 'upcoming' ? 'text-gray-500' : 'text-slate-900'}`}>{e.title}</p>
          <p className="text-xs">{start.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}{e.ends_at && ` – ${end.toLocaleTimeString([], { timeStyle: 'short' })}`} · {e.group?.title ?? (e.visibility === 'private' ? 'Personal' : e.visibility)} · host {isHost ? 'you' : host.name}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold">
          {status === 'upcoming' && <><Lock size={13} /> Starts in {span(start - now)}</>}
          {status === 'live' && <span className="flex items-center gap-1 text-green-700"><Radio size={13} className="animate-pulse" /> Live now</span>}
          {status === 'ended' && 'Ended'}
          {status === 'completed' && <span className="flex items-center gap-1 text-hunter-700"><CheckCircle2 size={13} aria-hidden="true" /> Completed</span>}
        </span>
      </div>
      {status !== 'upcoming' && e.can_complete && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggleDone}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hunter-700 px-3 py-1.5 text-sm font-semibold text-hunter-700 hover:bg-hunter-50">
            {status === 'completed' ? <><RotateCcw size={14} aria-hidden="true" /> Reopen session</> : <><CheckCircle2 size={14} aria-hidden="true" /> Mark as completed</>}
          </button>
          {status === 'completed' && e.completed_at && <span className="text-xs text-gray-500">Completed {new Date(e.completed_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>}
        </div>
      )}
      {status !== 'ended' && status !== 'completed' && !solo && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button disabled={!can} title={why || 'Voice'} onClick={() => go(false)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
            <Phone size={14} /> {isHost ? 'Start voice' : 'Join voice'}
          </button>
          <button disabled={!can} title={why || 'Video'} onClick={() => go(true)}
            className="flex items-center gap-1.5 rounded-lg bg-raspberry-600 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
            <Video size={14} /> {isHost ? 'Start video' : 'Join video'}
          </button>
          <span className="text-xs">{status === 'upcoming' ? 'Opens at the start time' : why}</span>
        </div>
      )}
    </div>
  );
}
