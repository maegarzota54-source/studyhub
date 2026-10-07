import { useEffect, useState } from 'react';
import { Phone, Video } from 'lucide-react';
import { startCall, useCall } from '@/lib/callManager';

/**
 * The "Voice call / Video call" buttons used on the group page and in private chat.
 *   targets = user ids who could be called   people = [{ id, name, avatar_url }] to show their names
 * Only people who are online right now are rung. The call itself appears in <CallOverlay /> (see AppLayout).
 */
export default function CallPanel({ targets = [], people = [] }) {
  const c = useCall();
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); window.addEventListener('presence', f); return () => window.removeEventListener('presence', f); }, []);

  const online = targets.filter((id) => window.__online?.has(id)).map((id) => people.find((p) => p.id === id) ?? { id, name: 'Member' });
  const off = c.status !== 'idle' || !online.length || !c.ready;
  const why = c.status !== 'idle' ? 'You are already in a call' : !online.length ? 'Nobody to call: no one else is online' : !c.ready ? 'Connecting…' : '';

  return (
    <div className="rounded-xl bg-slate-900 p-3 text-white">
      <div className="flex gap-2">
        <button disabled={off} title={why || 'Voice call'} onClick={() => startCall(online, { video: false })}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40">
          <Phone size={16} /> Voice call
        </button>
        <button disabled={off} title={why || 'Video call'} onClick={() => startCall(online, { video: true })}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-raspberry-600 px-3 py-2 text-sm font-semibold hover:bg-raspberry-500 disabled:cursor-not-allowed disabled:opacity-40">
          <Video size={16} /> Video call
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-300">{online.length ? `${online.length} online and can be called` : 'No one else is online right now'}</p>
    </div>
  );
}
