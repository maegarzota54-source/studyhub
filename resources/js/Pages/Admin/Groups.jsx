import { Head, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import AdminLayout, { Badge, Btn, Pager, Panel, inputCls, useLiveFilters } from '@/Layouts/AdminLayout';

export default function Groups({ groups, filters }) {
    const [f, set] = useLiveFilters('admin.groups', { q: filters.q ?? '' });
    return (
        <AdminLayout title="Study groups" crumbs={[['Groups']]} actions={<span className="text-sm text-gray-500">{groups.total} groups</span>}>
            <Head title="Groups" />
            <Panel>
                <div className="relative border-b border-gray-100 p-4">
                    <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className={`${inputCls} pl-9`} placeholder="Search title or topic" value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="Search groups" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Group', 'Owner', 'Level', 'Members', 'Messages', 'Created', ''].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
                        <tbody>
                            {groups.data.length === 0 && <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">No groups found.</td></tr>}
                            {groups.data.map((g) => (
                                <tr key={g.id} className="border-t border-gray-100">
                                    <td className="px-4 py-3"><b>{g.title}</b><span className="block text-xs text-gray-500">{g.topic}</span></td>
                                    <td className="px-4 py-3">{g.owner?.name}</td>
                                    <td className="px-4 py-3"><Badge tone="green">{g.skill_level}</Badge></td>
                                    <td className="px-4 py-3">{g.members_count}/{g.max_members}</td>
                                    <td className="px-4 py-3">{g.messages_count}</td>
                                    <td className="px-4 py-3 text-gray-500">{new Date(g.created_at).toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-right"><Btn tone="danger" onClick={() => confirm(`Delete “${g.title}” for all ${g.members_count} members? This removes its chat, files and tasks.`) && router.delete(route('admin.groups.destroy', g.id), { preserveScroll: true })}>Delete</Btn></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pager links={groups.links} />
            </Panel>
        </AdminLayout>
    );
}
