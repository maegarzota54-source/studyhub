import { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { CalendarDays, MessageSquare, Users } from 'lucide-react';
import AppLayout, { Btn, Card, inputCls } from '@/Layouts/AppLayout';

export function Avatars({ people, max = 4 }) {
  if (!people?.length) return <span className="text-xs text-gray-400">Unassigned</span>;
  return (
    <span className="inline-flex items-center">
      {people.slice(0, max).map((p) => <img key={p.id} src={p.avatar_url} title={p.name} alt={p.name} className="-ml-1.5 h-5 w-5 rounded-full object-cover ring-2 ring-white first:ml-0" />)}
      {people.length > max && <span className="ml-1 text-xs text-gray-500">+{people.length - max}</span>}
    </span>
  );
}

function TaskCard({ t }) {
  const done = t.status === 'completed';
  const overdue = !done && t.due_date && new Date(t.due_date) < new Date(new Date().toDateString());
  return (
    <Card className="transition hover:border-hunter-700/40">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={done} aria-label="Mark complete" className="mt-1 h-4 w-4 rounded text-hunter-700"
          onChange={() => router.patch(route('tasks.update', t.id), { status: done ? 'pending' : 'completed' }, { preserveScroll: true })} />
        <Link href={route('tasks.show', t.id)} className="min-w-0 flex-1">
          <p className={`font-medium hover:text-hunter-700 ${done ? 'text-gray-400 line-through' : ''}`}>{t.title}</p>
          {t.description && <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{t.description}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><Users size={12} />{t.group?.title ?? 'Personal'}</span>
            <Avatars people={t.assignees} />
            <span className={`inline-flex items-center gap-1 ${overdue ? 'font-medium text-raspberry-600' : ''}`}><CalendarDays size={12} />{t.due_date ?? 'No due date'}</span>
            <span className="inline-flex items-center gap-1"><MessageSquare size={12} />{t.comments_count}</span>
          </p>
        </Link>
        <span className={`rounded-full px-2 py-0.5 text-xs ${done ? 'bg-hunter-100 text-hunter-800' : 'bg-raspberry-500/10 text-raspberry-600'}`}>{done ? 'Completed' : 'Pending'}</span>
      </div>
    </Card>
  );
}

export default function Tasks({ tasks, groups }) {
  const [filter, setFilter] = useState('all');
  const f = useForm({ title: '', description: '', due_date: '', study_group_id: '', assignee_ids: [], post_to_chat: true });
  const members = groups.find((g) => String(g.id) === String(f.data.study_group_id))?.members ?? [];
  const toggle = (id) => f.setData('assignee_ids', f.data.assignee_ids.includes(id) ? f.data.assignee_ids.filter((x) => x !== id) : [...f.data.assignee_ids, id]);
  const shown = tasks.filter((t) => filter === 'all' || t.status === filter);
  return (
    <AppLayout title="Tasks & Checklist">
      <Head title="Tasks" />
      <Card className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); f.post(route('tasks.store'), { onSuccess: () => f.reset() }); }} className="grid gap-2 md:grid-cols-4">
          <input className={`${inputCls} md:col-span-2`} placeholder="Task title" value={f.data.title} onChange={(e) => f.setData('title', e.target.value)} />
          <input type="date" className={inputCls} value={f.data.due_date} onChange={(e) => f.setData('due_date', e.target.value)} aria-label="Due date" />
          <select className={inputCls} value={f.data.study_group_id} onChange={(e) => f.setData({ ...f.data, study_group_id: e.target.value, assignee_ids: [] })}>
            <option value="">Personal task</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <textarea className={`${inputCls} md:col-span-4`} rows={2} placeholder="Description (what needs to be done?)" value={f.data.description} onChange={(e) => f.setData('description', e.target.value)} />
          {f.data.study_group_id && (
            <div className="md:col-span-4">
              <p className="mb-1 text-xs font-medium text-gray-600">Assign to (pick one or more)</p>
              <div className="flex flex-wrap gap-2">
                {members.map((u) => (
                  <label key={u.id} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${f.data.assignee_ids.includes(u.id) ? 'border-hunter-700 bg-hunter-700 text-white' : 'border-gray-300 bg-white'}`}>
                    <input type="checkbox" className="sr-only" checked={f.data.assignee_ids.includes(u.id)} onChange={() => toggle(u.id)} />{u.name}
                  </label>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" className="rounded text-hunter-700" checked={f.data.post_to_chat} onChange={(e) => f.setData('post_to_chat', e.target.checked)} /> Post this task in the group chat
              </label>
            </div>
          )}
          {Object.values(f.errors).map((e) => <p key={e} className="text-xs text-raspberry-600 md:col-span-4">{e}</p>)}
          <div><Btn disabled={f.processing}>Add task</Btn></div>
        </form>
      </Card>
      <div className="mb-3 flex gap-2">{['all', 'pending', 'completed'].map((s) => <Btn key={s} variant={filter === s ? 'primary' : 'ghost'} onClick={() => setFilter(s)} className="capitalize">{s}</Btn>)}</div>
      <div className="space-y-3">{shown.length === 0 && <p className="text-sm text-gray-500">No tasks here.</p>}{shown.map((t) => <TaskCard key={t.id} t={t} />)}</div>
    </AppLayout>
  );
}
