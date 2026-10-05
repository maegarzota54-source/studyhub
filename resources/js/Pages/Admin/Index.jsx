import { Head, router } from '@inertiajs/react';
import AppLayout, { Btn, Card } from '@/Layouts/AppLayout';

export default function Admin({ metrics, users, groups, flagged }) {
  return (
    <AppLayout title="Admin Dashboard">
      <Head title="Admin" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {Object.entries(metrics).map(([k, v]) => <Card key={k}><p className="text-2xl font-bold text-hunter-700">{v}</p><p className="text-xs text-gray-500">{k.replace('_', ' ')}</p></Card>)}
      </div>
      <Card className="mt-6"><h2 className="mb-2 font-semibold">Flagged content ({flagged.length})</h2>
        {flagged.length === 0 && <p className="text-sm text-gray-500">Nothing reported.</p>}
        {flagged.map((m) => (
          <div key={m.id} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-0">
            <p className="flex-1 text-sm"><b>{m.sender.name}</b> in {m.group?.title ?? 'a direct message'}: {m.body ?? m.attachment_name}</p>
            <Btn variant="ghost" onClick={() => router.post(route('admin.messages.clear', m.id))}>Dismiss</Btn>
            <Btn variant="accent" onClick={() => router.delete(route('admin.messages.destroy', m.id))}>Remove</Btn>
          </div>))}
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><h2 className="mb-2 font-semibold">Users</h2>
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-0">
              <span>{u.name} <span className="text-xs text-gray-500">{u.email} · {u.role}</span></span>
              {u.role !== 'admin' && <Btn variant={u.is_suspended ? 'primary' : 'ghost'} onClick={() => router.patch(route('admin.users.suspend', u.id))}>{u.is_suspended ? 'Reinstate' : 'Suspend'}</Btn>}
            </div>))}
        </Card>
        <Card><h2 className="mb-2 font-semibold">Study groups</h2>
          {groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-0">
              <span>{g.title} <span className="text-xs text-gray-500">{g.members_count} members · {g.owner.name}</span></span>
              <Btn variant="accent" onClick={() => confirm('Delete this group?') && router.delete(route('admin.groups.destroy', g.id))}>Delete</Btn>
            </div>))}
        </Card>
      </div>
    </AppLayout>
  );
}
