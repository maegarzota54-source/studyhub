import { Head, router, useForm } from '@inertiajs/react';
import AppLayout, { Btn, Card, inputCls } from '@/Layouts/AppLayout';

const size = (b) => (b ? (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.ceil(b / 1e3) + ' KB') : '');

export default function Files({ items, groups, filters }) {
  const f = useForm({ kind: 'note', title: '', body: '', study_group_id: '', file: null });
  const filter = (k, v) => router.get(route('files.index'), { ...filters, [k]: v || undefined }, { preserveState: true });
  return (
    <AppLayout title="Notes & Files">
      <Head title="Notes & Files" />
      <Card className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); f.post(route('files.store'), { forceFormData: true, onSuccess: () => f.reset('title', 'body', 'file') }); }} className="grid gap-2 md:grid-cols-4">
          <select className={inputCls} value={f.data.kind} onChange={(e) => f.setData('kind', e.target.value)}><option value="note">Note</option><option value="file">File</option><option value="module">Study module</option></select>
          <select className={inputCls} value={f.data.study_group_id} onChange={(e) => f.setData('study_group_id', e.target.value)}><option value="">Personal</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select>
          <input className={`${inputCls} md:col-span-2`} placeholder="Title" value={f.data.title} onChange={(e) => f.setData('title', e.target.value)} />
          <textarea className={`${inputCls} md:col-span-3`} placeholder="Note text (optional)" value={f.data.body} onChange={(e) => f.setData('body', e.target.value)} />
          <input type="file" className={inputCls} onChange={(e) => f.setData('file', e.target.files[0])} />
          {Object.values(f.errors).map((m) => <p key={m} className="text-xs text-raspberry-600 md:col-span-4">{m}</p>)}
          <Btn disabled={f.processing}>Save</Btn>
        </form>
      </Card>
      <div className="mb-3 flex gap-2">
        <select className="rounded-lg border-gray-300 text-sm" value={filters.group_id ?? ''} onChange={(e) => filter('group_id', e.target.value)}>
          <option value="">All sources</option><option value="personal">Personal</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
        <select className="rounded-lg border-gray-300 text-sm" value={filters.kind ?? ''} onChange={(e) => filter('kind', e.target.value)}>
          <option value="">All types</option><option value="note">Notes</option><option value="file">Files</option><option value="module">Modules</option>
        </select>
      </div>
      <Card className="divide-y divide-gray-100 p-0">
        {items.length === 0 && <p className="p-5 text-sm text-gray-500">Nothing here yet. Save a note or upload a file.</p>}
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{i.title}</p>
              <p className="text-xs text-gray-500">{i.kind} · {i.group?.title ?? 'Personal'} · {i.user.name} {size(i.size)}</p></div>
            {i.path && <a className="text-sm text-hunter-700 underline" href={route('files.download', i.id)}>Download</a>}
            <button className="text-sm text-raspberry-600" onClick={() => confirm('Delete?') && router.delete(route('files.destroy', i.id))}>Delete</button>
          </div>
        ))}
      </Card>
    </AppLayout>
  );
}
