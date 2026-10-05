import { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AppLayout, { Btn, Card, inputCls } from '@/Layouts/AppLayout';

function TaskCard({ t }) {
  const [open, setOpen] = useState(false);
  const c = useForm({ body: '' });
  const done = t.status === 'completed';
  return (
    <Card>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={done} aria-label="Mark complete" className="mt-1 h-4 w-4 rounded text-hunter-700"
          onChange={() => router.patch(route('tasks.update', t.id), { status: done ? 'pending' : 'completed' }, { preserveScroll: true })} />
        <div className="flex-1">
          <p className={`font-medium ${done ? 'text-gray-400 line-through' : ''}`}>{t.title}</p>
          <p className="text-xs text-gray-500">{t.group?.title ?? 'Personal'} · {t.assignee?.name ?? 'Unassigned'} · due {t.due_date ?? '—'}</p>
          {t.description && <p className="mt-1 text-sm">{t.description}</p>}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${done ? 'bg-hunter-100 text-hunter-800' : 'bg-raspberry-500/10 text-raspberry-600'}`}>{done ? 'Completed' : 'Pending'}</span>
      </div>
      <button className="mt-2 text-xs text-hunter-700 underline" onClick={() => setOpen(!open)}>{t.comments.length} comment(s)</button>
      {open && (<div className="mt-2 space-y-1">
        {t.comments.map((x) => <p key={x.id} className="text-sm"><b>{x.user.name}:</b> {x.body}</p>)}
        <form onSubmit={(e) => { e.preventDefault(); c.post(route('tasks.comment', t.id), { preserveScroll: true, onSuccess: () => c.reset() }); }} className="flex gap-2">
          <input className={inputCls} placeholder="Add feedback" value={c.data.body} onChange={(e) => c.setData('body', e.target.value)} /><Btn>Post</Btn>
        </form></div>)}
    </Card>
  );
}

export default function Tasks({ tasks, groups }) {
  const [filter, setFilter] = useState('all');
  const f = useForm({ title: '', description: '', due_date: '', study_group_id: '', assignee_id: '' });
  const members = groups.find((g) => String(g.id) === String(f.data.study_group_id))?.members ?? [];
  const shown = tasks.filter((t) => filter === 'all' || t.status === filter);
  return (
    <AppLayout title="Tasks & Checklist">
      <Head title="Tasks" />
      <Card className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); f.post(route('tasks.store'), { onSuccess: () => f.reset() }); }} className="grid gap-2 md:grid-cols-4">
          <input className={`${inputCls} md:col-span-2`} placeholder="Task title" value={f.data.title} onChange={(e) => f.setData('title', e.target.value)} />
          <input type="date" className={inputCls} value={f.data.due_date} onChange={(e) => f.setData('due_date', e.target.value)} aria-label="Due date" />
          <select className={inputCls} value={f.data.study_group_id} onChange={(e) => f.setData({ ...f.data, study_group_id: e.target.value, assignee_id: '' })}><option value="">Personal task</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select>
          <textarea className={`${inputCls} md:col-span-2`} placeholder="Description" value={f.data.description} onChange={(e) => f.setData('description', e.target.value)} />
          {f.data.study_group_id && <select className={inputCls} value={f.data.assignee_id} onChange={(e) => f.setData('assignee_id', e.target.value)}><option value="">Assign to…</option>{members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
          {Object.values(f.errors).map((e) => <p key={e} className="text-xs text-raspberry-600">{e}</p>)}
          <Btn disabled={f.processing}>Add task</Btn>
        </form>
      </Card>
      <div className="mb-3 flex gap-2">{['all', 'pending', 'completed'].map((s) => <Btn key={s} variant={filter === s ? 'primary' : 'ghost'} onClick={() => setFilter(s)} className="capitalize">{s}</Btn>)}</div>
      <div className="space-y-3">{shown.length === 0 && <p className="text-sm text-gray-500">No tasks here.</p>}{shown.map((t) => <TaskCard key={t.id} t={t} />)}</div>
    </AppLayout>
  );
}
