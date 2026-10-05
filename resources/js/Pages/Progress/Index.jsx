import { useEffect, useRef, useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppLayout, { Btn, Card, inputCls } from '@/Layouts/AppLayout';

function Timer({ onStop }) {
  const [secs, setSecs] = useState(0), [run, setRun] = useState(false), id = useRef();
  useEffect(() => { if (run) id.current = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(id.current); }, [run]);
  const fmt = `${String(Math.floor(secs / 3600)).padStart(2, '0')}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-2xl tabular-nums">{fmt}</span>
      <Btn onClick={() => setRun(!run)}>{run ? 'Pause' : secs ? 'Resume' : 'Start timer'}</Btn>
      {secs >= 60 && <Btn variant="accent" onClick={() => { setRun(false); onStop(Math.round(secs / 60)); setSecs(0); }}>Stop and log</Btn>}
    </div>
  );
}

export default function Progress({ daily, weekHours, totalHours, groupBoards, recent, groups }) {
  const f = useForm({ minutes: 30, topic: '', study_group_id: '' });
  const log = (mins) => f.transform((d) => ({ ...d, minutes: mins ?? d.minutes })).post(route('progress.store'), { preserveScroll: true });
  return (
    <AppLayout title="Study Session Tracking">
      <Head title="Progress" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card><p className="text-3xl font-bold text-hunter-700">{weekHours} h</p><p className="text-sm text-gray-500">This week</p>
          <p className="mt-3 text-xl font-semibold">{totalHours} h</p><p className="text-sm text-gray-500">All time</p></Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-2 font-semibold">Hours per day (last 7 days)</h2>
          <div className="h-48"><ResponsiveContainer><BarChart data={daily}><XAxis dataKey="day" /><YAxis width={30} /><Tooltip /><Bar dataKey="hours" fill="#355E3B" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Card>
        <Card className="lg:col-span-3">
          <h2 className="mb-3 font-semibold">Log study time</h2>
          <Timer onStop={log} />
          <form onSubmit={(e) => { e.preventDefault(); log(); }} className="mt-4 grid gap-2 md:grid-cols-4">
            <input type="number" min="1" className={inputCls} value={f.data.minutes} onChange={(e) => f.setData('minutes', e.target.value)} aria-label="Minutes" />
            <input className={inputCls} placeholder="Topic" value={f.data.topic} onChange={(e) => f.setData('topic', e.target.value)} />
            <select className={inputCls} value={f.data.study_group_id} onChange={(e) => f.setData('study_group_id', e.target.value)}><option value="">Personal</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select>
            <Btn disabled={f.processing}>Log manually</Btn>
          </form>
        </Card>
        {groupBoards.map((g) => {
          const max = Math.max(1, ...g.members.map((m) => m.hours));
          return (
            <Card key={g.id}><h3 className="mb-2 font-semibold">{g.title} · this week</h3>
              {g.members.map((m) => (
                <div key={m.name} className="mb-2"><div className="flex justify-between text-xs"><span>{m.name}</span><span>{m.hours} h</span></div>
                  <div className="h-2 rounded bg-cool-100"><div className="h-2 rounded bg-raspberry-600" style={{ width: `${(m.hours / max) * 100}%` }} /></div></div>
              ))}</Card>
          );
        })}
        <Card className="lg:col-span-3"><h2 className="mb-2 font-semibold">Recent sessions</h2>
          {recent.map((s) => <p key={s.id} className="flex justify-between border-b border-gray-100 py-1 text-sm last:border-0"><span>{s.topic || s.group?.title || 'Personal study'}</span><span className="text-gray-500">{s.studied_on} · {s.minutes} min</span></p>)}</Card>
      </div>
    </AppLayout>
  );
}
