import { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import AppLayout, { Btn, Card, inputCls } from '@/Layouts/AppLayout';

function CreateGroup() {
  const f = useForm({ title: '', topic: '', description: '', target_date: '', skill_level: 'intermediate', mode: 'online', max_members: 10 });
  const set = (k) => (e) => f.setData(k, e.target.value);
  return (
    <Card>
      <h2 className="mb-3 font-semibold">Create a study circle</h2>
      <form onSubmit={(e) => { e.preventDefault(); f.post(route('groups.store')); }} className="grid gap-3 md:grid-cols-2">
        <input className={inputCls} placeholder="Group title" value={f.data.title} onChange={set('title')} />
        <input className={inputCls} placeholder="Topic of study" value={f.data.topic} onChange={set('topic')} />
        <input type="date" className={inputCls} value={f.data.target_date} onChange={set('target_date')} aria-label="Target date" />
        <select className={inputCls} value={f.data.skill_level} onChange={set('skill_level')}>{['beginner', 'intermediate', 'advanced'].map((s) => <option key={s}>{s}</option>)}</select>
        <textarea className={`${inputCls} md:col-span-2`} placeholder="Description" value={f.data.description} onChange={set('description')} />
        {Object.values(f.errors).map((e) => <p key={e} className="text-xs text-raspberry-600 md:col-span-2">{e}</p>)}
        <Btn disabled={f.processing}>Create circle</Btn>
      </form>
    </Card>
  );
}

export default function GroupsIndex({ mode, groups, filters = {} }) {
  const list = groups.data ?? groups;
  const [q, setQ] = useState(filters.q ?? '');
  return (
    <AppLayout title={mode === 'find' ? 'Find Study Groups' : 'My Study Circles'}>
      <Head title="Groups" />
      {mode === 'find' ? (
        <form onSubmit={(e) => { e.preventDefault(); router.get(route('groups.find'), { q }, { preserveState: true }); }} className="mb-4 flex gap-2">
          <input className={inputCls} placeholder="Search by title or topic" value={q} onChange={(e) => setQ(e.target.value)} />
          <Btn>Search</Btn>
        </form>
      ) : <div className="mb-6"><CreateGroup /></div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.length === 0 && <p className="text-sm text-gray-500">{mode === 'find' ? 'No circles match. Try another topic.' : "You haven't joined a circle yet."}</p>}
        {list.map((g) => (
          <Card key={g.id}>
            <h3 className="font-semibold">{g.title}</h3>
            <p className="text-sm text-gray-500">{g.topic} · {g.skill_level} · {g.mode}</p>
            <p className="mt-1 line-clamp-2 text-sm">{g.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">{g.members_count}/{g.max_members} members</span>
              {g.is_member === false
                ? <Btn onClick={() => router.post(route('groups.join', g.id))}>Join</Btn>
                : <Link href={route('groups.show', g.id)} className="rounded-lg bg-hunter-700 px-4 py-2 text-sm font-semibold text-white">Open</Link>}
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
