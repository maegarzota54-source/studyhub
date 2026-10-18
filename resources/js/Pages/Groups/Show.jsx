import { useEffect, useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { MessageSquare } from 'lucide-react';
import AppLayout, { Btn, Card, inputCls } from '@/Layouts/AppLayout';
import ChatPanel from '@/Components/ChatPanel';
import CallPanel from '@/Components/CallPanel';
import OnlineDot from '@/Components/OnlineDot';
import SharedReader from '@/Components/SharedReader';
import SessionCard from '@/Components/SessionCard';

export default function GroupShow({ group, isGroupAdmin, members, messages, modules, tasks, events, auth }) {
  const [tab, setTab] = useState('chat');
  const me = auth.user;
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); window.addEventListener('presence', f); return () => window.removeEventListener('presence', f); }, []);
  const isOn = (id) => id === me.id || window.__online?.has(id);
  const onlineList = members.filter((m) => isOn(m.id)), offlineList = members.filter((m) => !isOn(m.id));
  const mod = useForm({ kind: 'module', title: '', body: '', study_group_id: group.id, file: null });

  return (
    <AppLayout title={group.title}>
      <Head title={group.title} />
      <Card className="mb-4">
        <p className="text-sm text-gray-500">{group.topic}{group.target_date && ` · target ${group.target_date}`}</p>
        <p className="mt-1 text-sm">{group.description}</p>
        <div className="mt-3 flex -space-x-2">
          {members.map((m) => <img key={m.id} src={m.avatar_url} title={m.name} alt={m.name} className="h-8 w-8 rounded-full border-2 border-white" />)}
        </div>
      </Card>
      <div className="mb-4 flex gap-1 border-b border-gray-200" role="tablist">
        {['chat', 'modules', 'tasks', 'schedule'].map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize ${tab === t ? 'border-b-2 border-raspberry-600 font-semibold text-hunter-700' : 'text-gray-500'}`}>{t}</button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><ChatPanel threaded messages={messages} channel={`group.${group.id}`} postUrl={route('messages.group', group.id)} /></div>
          <div className="space-y-3">
            <SharedReader groupId={group.id} />
            <CallPanel targets={members.filter((m) => m.id !== me.id).map((m) => m.id)} people={members} log={{ group_id: group.id }} />
            <Card>
              <h3 className="mb-2 text-sm font-semibold">Members <span className="font-normal text-gray-500">· {onlineList.length} online</span></h3>
              <div className="max-h-72 overflow-y-auto pr-1">
                {[['Online', onlineList], ['Offline', offlineList]].map(([label, list]) => list.length > 0 && (
                  <div key={label} className="mb-2">
                    <p className="sticky top-0 z-10 mb-1 bg-white py-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{label} ({list.length})</p>
                    {list.map((m) => {
                      const row = (
                        <>
                          <div className="relative shrink-0">
                            <img src={m.avatar_url} className="h-8 w-8 rounded-full" alt="" />
                            <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white"><OnlineDot userId={m.id} /></span>
                          </div>
                          <span className="min-w-0 flex-1 truncate text-sm">{m.name}{m.id === me.id && <span className="text-gray-400"> (you)</span>}{m.id === group.owner_id && <span className="ml-1 rounded bg-hunter-50 px-1.5 text-xs text-hunter-700">owner</span>}</span>
                          {m.id !== me.id && <MessageSquare size={14} className="shrink-0 text-gray-400" />}
                        </>
                      );
                      const cls = `flex items-center gap-2 rounded-lg px-1 py-1.5 ${label === 'Offline' ? 'opacity-60' : ''}`;
                      return m.id === me.id
                        ? <div key={m.id} className={cls}>{row}</div>
                        : <Link key={m.id} href={route('messages.index', { user_id: m.id })} title={`Message ${m.name}`} className={`${cls} hover:bg-cool-100`}>{row}</Link>;
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                {group.owner_id !== me.id && <Btn variant="ghost" onClick={() => confirm('Leave this circle?') && router.delete(route('groups.leave', group.id))}>Leave circle</Btn>}
                {group.owner_id === me.id && <Btn variant="accent" onClick={() => confirm('Delete this circle for everyone?') && router.delete(route('groups.destroy', group.id))}>Delete circle</Btn>}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'modules' && (
        <div className="space-y-4">
          <Card>
            <form onSubmit={(e) => { e.preventDefault(); mod.post(route('files.store'), { forceFormData: true, onSuccess: () => mod.reset('title', 'body', 'file') }); }} className="grid gap-2 md:grid-cols-2">
              <input className={inputCls} placeholder="Module title" value={mod.data.title} onChange={(e) => mod.setData('title', e.target.value)} />
              <input type="file" className={inputCls} onChange={(e) => mod.setData('file', e.target.files[0])} />
              <textarea className={`${inputCls} md:col-span-2`} placeholder="What should members learn from this?" value={mod.data.body} onChange={(e) => mod.setData('body', e.target.value)} />
              <Btn disabled={mod.processing}>Upload module</Btn>
            </form>
          </Card>
          {modules.map((m) => (
            <Card key={m.id}><b>{m.title}</b> <span className="text-xs text-gray-500">by {m.user.name}</span><p className="text-sm">{m.body}</p>
              {m.path && <a className="text-sm text-raspberry-600 underline" href={route('files.download', m.id)}>Download</a>}</Card>
          ))}
        </div>
      )}

      {tab === 'tasks' && <div className="space-y-2">{tasks.length === 0 && <p className="text-sm text-gray-500">No tasks yet. Add one from the Tasks page.</p>}
        {tasks.map((t) => <Card key={t.id}><Link href={route('tasks.show', t.id)} className="block"><b className={`hover:text-hunter-700 ${t.status === 'completed' ? 'text-gray-400 line-through' : ''}`}>{t.title}</b> <span className="text-xs text-gray-500">{t.assignees.length ? t.assignees.map((a) => a.name).join(', ') : 'Unassigned'} · {t.status} · due {t.due_date ?? '—'} · {t.comments_count} comment(s)</span></Link></Card>)}</div>}

      {tab === 'schedule' && <div className="space-y-3">{events.length === 0 && <p className="text-sm text-gray-500">No sessions visible to you.</p>}
        {events.map((e) => <SessionCard key={e.id} event={e} people={members} me={me} />)}</div>}
    </AppLayout>
  );
} 