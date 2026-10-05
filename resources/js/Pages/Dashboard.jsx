import { Head, Link } from '@inertiajs/react';
import AppLayout, { Card } from '@/Layouts/AppLayout';

export default function Dashboard({ stats, sessions, notifications }) {
  const tiles = [['My Groups', stats.groups], ['Upcoming sessions', stats.upcoming], ['Tasks due', stats.tasks_due], ['Hours this week', stats.hours_week]];
  return (
    <AppLayout title="Dashboard">
      <Head title="Dashboard" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(([l, v]) => <Card key={l}><p className="text-3xl font-bold text-hunter-700">{v}</p><p className="text-sm text-gray-500">{l}</p></Card>)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Upcoming study sessions</h2>
          {sessions.length === 0 && <p className="text-sm text-gray-500">Nothing scheduled. <Link className="text-raspberry-600 underline" href={route('schedule.index')}>Plan a session</Link></p>}
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
              <div><p className="text-sm font-medium">{s.title}</p><p className="text-xs text-gray-500">{s.group?.title} · {new Date(s.starts_at).toLocaleString()}</p></div>
              {s.group && <Link href={route('groups.show', s.study_group_id)} className="rounded-lg bg-hunter-700 px-3 py-1 text-xs font-semibold text-white">Open</Link>}
            </div>
          ))}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Recent notifications</h2>
          {notifications.length === 0 && <p className="text-sm text-gray-500">You're all caught up.</p>}
          {notifications.map((n) => <p key={n.id} className="border-b border-gray-100 py-2 text-sm last:border-0">{n.message}<span className="block text-xs text-gray-400">{n.ago}</span></p>)}
        </Card>
      </div>
    </AppLayout>
  );
}
