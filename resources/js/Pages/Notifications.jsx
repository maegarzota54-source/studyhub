import { Head, Link, router } from '@inertiajs/react';
import AppLayout, { Btn, Card } from '@/Layouts/AppLayout';
import AdminLayout, { Btn as AdminBtn, Panel } from '@/Layouts/AdminLayout';

export default function Notifications({ items }) {
    const admin = new URLSearchParams(window.location.search).get('view') === 'admin';
    const markAll = () => router.post(route('notifications.read'));

    const rows = items.map((n) => (
        <div key={n.id} className={`px-5 py-3 text-sm ${n.read ? '' : 'bg-[#eef4ef] font-medium'}`}>
            {n.url ? <Link href={n.url}>{n.message}</Link> : n.message}
            <span className="ml-2 text-xs text-gray-400">{n.ago}</span>
        </div>
    ));
    const empty = <p className="p-5 text-sm text-gray-500">No notifications yet.</p>;

    if (admin) {
        return (
            <AdminLayout title="Notifications" crumbs={[['Notifications']]}
                actions={<AdminBtn onClick={markAll}>Mark all as read</AdminBtn>}>
                <Head title="Notifications" />
                <Panel className="divide-y divide-gray-100">{items.length ? rows : empty}</Panel>
            </AdminLayout>
        );
    }

    return (
        <AppLayout title="Notifications">
            <Head title="Notifications" />
            <div className="mb-3 text-right"><Btn variant="ghost" onClick={markAll}>Mark all as read</Btn></div>
            <Card className="divide-y divide-gray-100 p-0">{items.length ? rows : empty}</Card>
        </AppLayout>
    );
}