import { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AppLayout, { Btn, Card, inputCls } from '@/Layouts/AppLayout';

export default function Schedule({ month, events, groups }) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1), start = new Date(first); start.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const byDay = events.reduce((a, e) => { const k = e.starts_at.slice(0, 10); (a[k] ||= []).push(e); return a; }, {});
  const go = (delta) => { const d = new Date(y, m - 1 + delta, 1); router.get(route('schedule.index'), { month: key(d).slice(0, 7) }, { preserveState: true }); };

  const f = useForm({ title: '', starts_at: '', ends_at: '', study_group_id: '', visibility: 'public', attendees: [] });
  const members = groups.find((g) => String(g.id) === String(f.data.study_group_id))?.members ?? [];
  const toggle = (id) => f.setData('attendees', f.data.attendees.includes(id) ? f.data.attendees.filter((x) => x !== id) : [...f.data.attendees, id]);

  return (
    <AppLayout title="Study Schedule">
      <Head title="Schedule" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <Btn variant="ghost" onClick={() => go(-1)} aria-label="Previous month">‹</Btn>
            <h2 className="font-semibold">{first.toLocaleString([], { month: 'long', year: 'numeric' })}</h2>
            <Btn variant="ghost" onClick={() => go(1)} aria-label="Next month">›</Btn>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-gray-200 text-xs">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="bg-cool-100 p-1 text-center font-medium">{d}</div>)}
            {cells.map((d) => (
              <div key={key(d)} className={`min-h-20 bg-white p-1 ${d.getMonth() !== m - 1 ? 'opacity-40' : ''}`}>
                <span className={key(d) === key(new Date()) ? 'rounded-full bg-raspberry-600 px-1.5 text-white' : ''}>{d.getDate()}</span>
                {(byDay[key(d)] ?? []).map((e) => <p key={e.id} title={`${e.title} (${e.visibility})`} className={`mt-0.5 truncate rounded px-1 ${e.visibility === 'public' ? 'bg-hunter-100 text-hunter-800' : 'bg-raspberry-500/10 text-raspberry-600'}`}>{e.title}</p>)}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Add a session</h2>
          <form onSubmit={(e) => { e.preventDefault(); f.post(route('schedule.store'), { onSuccess: () => f.reset() }); }} className="space-y-2">
            <input className={inputCls} placeholder="Title" value={f.data.title} onChange={(e) => f.setData('title', e.target.value)} />
            <input type="datetime-local" className={inputCls} value={f.data.starts_at} onChange={(e) => f.setData('starts_at', e.target.value)} aria-label="Starts" />
            <input type="datetime-local" className={inputCls} value={f.data.ends_at} onChange={(e) => f.setData('ends_at', e.target.value)} aria-label="Ends" />
            <select className={inputCls} value={f.data.study_group_id} onChange={(e) => f.setData('study_group_id', e.target.value)}><option value="">No circle (private)</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select>
            <select className={inputCls} value={f.data.visibility} onChange={(e) => f.setData('visibility', e.target.value)}>
              <option value="public">Public: all circle members</option><option value="specific">Specific people</option><option value="private">Private: only me</option>
            </select>
            {f.data.visibility === 'specific' && members.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.data.attendees.includes(u.id)} onChange={() => toggle(u.id)} /> {u.name}</label>
            ))}
            {Object.values(f.errors).map((e) => <p key={e} className="text-xs text-raspberry-600">{e}</p>)}
            <Btn disabled={f.processing}>Add to schedule</Btn>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
