import { useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, Pencil, Send, Share2, Trash2, Users } from 'lucide-react';
import AppLayout, { Btn, Card, inputCls } from '@/Layouts/AppLayout';

export default function TaskShow({ task, canManage, canEdit, members, groups }) {
  const me = usePage().props.auth.user;
  const done = task.status === 'completed';
  const [editing, setEditing] = useState(false);
  const [shareTo, setShareTo] = useState('');
  const e = useForm({ title: task.title, description: task.description ?? '', due_date: task.due_date ?? '', assignee_ids: task.assignees.map((a) => a.id) });
  const c = useForm({ body: '' });
  const patch = (data, opts = {}) => router.patch(route('tasks.update', task.id), data, { preserveScroll: true, ...opts });
  const toggle = (id) => e.setData('assignee_ids', e.data.assignee_ids.includes(id) ? e.data.assignee_ids.filter((x) => x !== id) : [...e.data.assignee_ids, id]);
  const save = (ev) => {
    ev.preventDefault();
    const data = canManage ? { ...e.data, assignee_ids: task.group ? e.data.assignee_ids : undefined } : {};
    patch(data, { onSuccess: () => setEditing(false) });
  };
  const back = task.group ? route('groups.show', task.group.id) : route('tasks.index');

  return (
    <AppLayout title="Task">
      <Head title={task.title} />
      <Link href={route('tasks.index')} className="mb-3 inline-flex items-center gap-1 text-sm text-hunter-700 hover:underline"><ArrowLeft size={14} /> All tasks</Link>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            {!editing ? (
              <>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={done} disabled={!canEdit} aria-label="Mark complete" className="mt-1.5 h-5 w-5 rounded text-hunter-700"
                    onChange={() => patch({ status: done ? 'pending' : 'completed' })} />
                  <h2 className={`flex-1 text-xl font-semibold ${done ? 'text-gray-400 line-through' : ''}`}>{task.title}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${done ? 'bg-hunter-100 text-hunter-800' : 'bg-raspberry-500/10 text-raspberry-600'}`}>{done ? 'Completed' : 'Pending'}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{task.description || <span className="text-gray-400">No description yet.</span>}</p>
                {canManage && (
                  <div className="mt-4 flex gap-2">
                    <Btn variant="ghost" onClick={() => setEditing(true)}><Pencil size={14} className="mr-1 inline" />Edit</Btn>
                    <Btn variant="ghost" onClick={() => confirm('Delete this task?') && router.delete(route('tasks.destroy', task.id))}><Trash2 size={14} className="mr-1 inline" />Delete</Btn>
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={save} className="space-y-2">
                <input className={inputCls} value={e.data.title} onChange={(ev) => e.setData('title', ev.target.value)} />
                <textarea className={inputCls} rows={5} placeholder="Description" value={e.data.description} onChange={(ev) => e.setData('description', ev.target.value)} />
                <input type="date" className={inputCls} value={e.data.due_date} onChange={(ev) => e.setData('due_date', ev.target.value)} />
                {task.group && (
                  <div className="flex flex-wrap gap-2">
                    {members.map((u) => (
                      <label key={u.id} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${e.data.assignee_ids.includes(u.id) ? 'border-hunter-700 bg-hunter-700 text-white' : 'border-gray-300'}`}>
                        <input type="checkbox" className="sr-only" checked={e.data.assignee_ids.includes(u.id)} onChange={() => toggle(u.id)} />{u.name}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-2"><Btn>Save</Btn><Btn type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Btn></div>
              </form>
            )}
          </Card>

          <Card>
            <h3 className="mb-3 font-semibold">Comments ({task.comments.length})</h3>
            <div className="space-y-3">
              {task.comments.length === 0 && <p className="text-sm text-gray-500">No comments yet. Share feedback or progress.</p>}
              {task.comments.map((x) => (
                <div key={x.id} className="flex gap-2">
                  <img src={x.user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500"><b className="text-slate-900">{x.user.name}</b> · {new Date(x.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    <p className="whitespace-pre-wrap break-words text-sm">{x.body}</p>
                  </div>
                  {(x.user_id === me.id || canManage) && (
                    <button className="text-gray-400 hover:text-raspberry-600" aria-label="Delete comment" onClick={() => router.delete(route('tasks.comment.destroy', [task.id, x.id]), { preserveScroll: true })}><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={(ev) => { ev.preventDefault(); c.post(route('tasks.comment', task.id), { preserveScroll: true, onSuccess: () => c.reset() }); }} className="mt-4 flex gap-2">
              <input className={inputCls} placeholder="Write a comment…" value={c.data.body} onChange={(ev) => c.setData('body', ev.target.value)} />
              <Btn disabled={c.processing || !c.data.body.trim()}><Send size={14} /></Btn>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs text-gray-500">Due</dt><dd className="flex items-center gap-1"><CalendarDays size={14} />{task.due_date ?? 'No due date'}</dd></div>
              <div><dt className="text-xs text-gray-500">Circle</dt><dd className="flex items-center gap-1"><Users size={14} />{task.group ? <Link className="text-hunter-700 hover:underline" href={back}>{task.group.title}</Link> : 'Personal'}</dd></div>
              <div><dt className="text-xs text-gray-500">Created by</dt><dd>{task.creator.name}</dd></div>
              <div>
                <dt className="mb-1 text-xs text-gray-500">Assigned members</dt>
                <dd className="space-y-1">
                  {task.assignees.length === 0 && <span className="text-gray-400">Nobody yet</span>}
                  {task.assignees.map((a) => <div key={a.id} className="flex items-center gap-2"><img src={a.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />{a.name}</div>)}
                </dd>
              </div>
            </dl>
          </Card>
          {canManage && !task.group && groups.length > 0 && (
            <Card>
              <h3 className="mb-2 flex items-center gap-1 font-semibold"><Share2 size={14} /> Share with a circle</h3>
              <p className="mb-2 text-xs text-gray-500">Posts this task in the group chat so everyone can open it, comment, and be assigned.</p>
              <select className={inputCls} value={shareTo} onChange={(ev) => setShareTo(ev.target.value)}><option value="">Choose a circle…</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select>
              <Btn className="mt-2" disabled={!shareTo} onClick={() => router.post(route('tasks.share', task.id), { study_group_id: shareTo }, { preserveScroll: true })}>Share</Btn>
            </Card>
          )}
          {canManage && task.group && (
            <Card><Btn variant="ghost" onClick={() => router.post(route('tasks.share', task.id), { study_group_id: task.study_group_id }, { preserveScroll: true })}><Share2 size={14} className="mr-1 inline" />Post again in group chat</Btn></Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
