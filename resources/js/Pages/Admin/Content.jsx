import { Head, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import AdminLayout, { Badge, Btn, Pager, Panel, inputCls, useLiveFilters } from '@/Layouts/AdminLayout';

const size = (b) => (b ? (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.ceil(b / 1e3)} KB`) : '–');

export default function Content({ items, filters }) {
    const [f, set] = useLiveFilters('admin.content', { q: filters.q ?? '', kind: filters.kind ?? '' });
    return (
        <AdminLayout title="Content" crumbs={[['Content']]} actions={<span className="text-sm text-gray-500">{items.total} items</span>}>
            <Head title="Content" />
            <Panel>
                <div className="flex flex-wrap gap-3 border-b border-gray-100 p-4">
                    <div className="relative min-w-[14rem] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input className={`${inputCls} pl-9`} placeholder="Search by title" value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="Search content" /></div>
                    <select className={`${inputCls} !w-auto`} value={f.kind} onChange={(e) => set('kind', e.target.value)} aria-label="Type"><option value="">All types</option><option value="note">Notes</option><option value="file">Files</option><option value="module">Study modules</option></select>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Title', 'Type', 'Owner', 'Group', 'Size', 'Added', ''].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
                        <tbody>
                            {items.data.length === 0 && <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">Nothing uploaded yet.</td></tr>}
                            {items.data.map((i) => (
                                <tr key={i.id} className="border-t border-gray-100">
                                    <td className="max-w-xs truncate px-4 py-3 font-medium">{i.title}</td>
                                    <td className="px-4 py-3"><Badge tone={i.kind === 'module' ? 'dark' : i.kind === 'note' ? 'pink' : 'green'}>{i.kind}</Badge></td>
                                    <td className="px-4 py-3">{i.user?.name}</td>
                                    <td className="px-4 py-3 text-gray-500">{i.group?.title ?? 'Personal'}</td>
                                    <td className="px-4 py-3 text-gray-500">{size(i.size)}</td>
                                    <td className="px-4 py-3 text-gray-500">{new Date(i.created_at).toLocaleDateString()}</td>
                                    <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                                        {i.path && <a href={route('admin.content.download', i.id)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100">Download</a>}
                                        <Btn tone="danger" onClick={() => confirm(`Delete “${i.title}”?`) && router.delete(route('admin.content.destroy', i.id), { preserveScroll: true })}>Delete</Btn>
                                    </div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pager links={items.links} />
            </Panel>
        </AdminLayout>
    );
}
