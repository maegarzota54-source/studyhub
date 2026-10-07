import { useEffect, useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { MessageSquare, Phone, Search, Video } from 'lucide-react';
import AppLayout, { Card, inputCls } from '@/Layouts/AppLayout';
import { startCall, useCall } from '@/lib/callManager';

export default function Members({ members, groups }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');     // all | active | offline
  const [group, setGroup] = useState('');
  const call = useCall();

  // Re-render when presence changes (every ~30s) and refresh the "last seen" text once a minute.
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    window.addEventListener('presence', f);
    const t = setInterval(() => router.reload({ only: ['members'], preserveScroll: true }), 60000);
    return () => { window.removeEventListener('presence', f); clearInterval(t); };
  }, []);

  const isOn = (m) => (window.__online ? window.__online.has(m.id) : m.online);
  const list = members
    .filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
    .filter((m) => !group || m.circles.some((c) => String(c.id) === String(group)))
    .filter((m) => status === 'all' || (status === 'active') === isOn(m))
    .sort((a, b) => Number(isOn(b)) - Number(isOn(a)) || a.name.localeCompare(b.name));

  const activeCount = members.filter(isOn).length;
  const busy = call.status !== 'idle';
  const ring = (m, video) => startCall([{ id: m.id, name: m.name, avatar_url: m.avatar_url }], { video });

  return (
    <AppLayout title="Members">
      <Head title="Members" />
      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={`${inputCls} pl-9`} placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
        </div>
        <select className={`${inputCls} md:w-56`} value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter by circle">
          <option value="">All circles</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Status">
        {[['all', `All (${members.length})`], ['active', `Active (${activeCount})`], ['offline', `Offline (${members.length - activeCount})`]].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={status === k} onClick={() => setStatus(k)}
            className={`rounded-full px-4 py-1.5 text-sm ${status === k ? 'bg-hunter-700 font-semibold text-white' : 'border border-gray-300 bg-white hover:bg-cool-100'}`}>{label}</button>
        ))}
      </div>

      {members.length === 0 && <Card><p className="text-sm text-gray-500">No members yet. Join a study circle and the people in it will show up here.</p></Card>}
      {members.length > 0 && list.length === 0 && <p className="text-sm text-gray-500">No members match.</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((m) => {
          const on = isOn(m);
          const why = busy ? 'You are already in a call' : !call.ready ? 'Connecting…' : !on ? `${m.name} is offline` : '';
          const disabled = !on || busy || !call.ready;
          return (
            <Card key={m.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <img src={m.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                  <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${on ? 'bg-green-500' : 'bg-gray-300'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className={`text-xs ${on ? 'font-medium text-green-600' : 'text-gray-500'}`}>
                    {on ? 'Active now' : `Offline · ${m.last_seen ? `last seen ${m.last_seen}` : 'not seen yet'}`}
                  </p>
                </div>
              </div>
              {m.bio && <p className="line-clamp-2 text-sm text-gray-600">{m.bio}</p>}
              {m.circles.length > 0 && (
                <div className="flex flex-wrap gap-1">{m.circles.map((c) => (
                  <Link key={c.id} href={route('groups.show', c.id)} className="rounded-full bg-hunter-50 px-2 py-0.5 text-xs text-hunter-800 hover:bg-hunter-100">{c.title}</Link>
                ))}</div>
              )}
              <div className="mt-auto flex gap-2 pt-1">
                <Link href={route('messages.index', { user_id: m.id })} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-cool-100">
                  <MessageSquare size={15} /> Message
                </Link>
                <button disabled={disabled} title={why || 'Voice call'} aria-label={`Voice call ${m.name}`} onClick={() => ring(m, false)}
                  className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-cool-100 disabled:cursor-not-allowed disabled:opacity-40"><Phone size={16} /></button>
                <button disabled={disabled} title={why || 'Video call'} aria-label={`Video call ${m.name}`} onClick={() => ring(m, true)}
                  className="rounded-lg bg-raspberry-600 px-3 py-2 text-white hover:bg-raspberry-500 disabled:cursor-not-allowed disabled:opacity-40"><Video size={16} /></button>
              </div>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
