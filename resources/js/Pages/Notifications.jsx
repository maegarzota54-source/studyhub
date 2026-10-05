import { Head, Link, router } from '@inertiajs/react';
import AppLayout, { Btn, Card } from '@/Layouts/AppLayout';
export default function Notifications({ items }) {
  return (
    <AppLayout title="Notifications">
      <Head title="Notifications" />
      <div className="mb-3 text-right"><Btn variant="ghost" onClick={() => router.post(route('notifications.read'))}>Mark all as read</Btn></div>
      <Card className="divide-y divide-gray-100 p-0">
        {items.length === 0 && <p className="p-5 text-sm text-gray-500">No notifications yet.</p>}
        {items.map((n) => (
          <div key={n.id} className={`px-5 py-3 text-sm ${n.read ? '' : 'bg-hunter-50 font-medium'}`}>
            {n.url ? <Link href={n.url}>{n.message}</Link> : n.message}<span className="ml-2 text-xs text-gray-400">{n.ago}</span>
          </div>
        ))}
      </Card>
    </AppLayout>
  );
}
