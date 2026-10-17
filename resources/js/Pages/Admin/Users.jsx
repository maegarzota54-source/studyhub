import { Head, router, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import AdminLayout, { Badge, Btn, Pager, Panel, inputCls, seen, useLiveFilters } from '@/Layouts/AdminLayout';

export default function Users({ users, filters, totals }) {
    const me = usePage().props.auth.user;
    const [f, set] = useLiveFilters('admin.users', { q: filters.q ?? '', role: filters.role ?? '', status: filters.status ?? '' });
    const act = (method, name, id, msg, data = {}) => { if (!msg || confirm(msg)) router[method](route(name, id), data, { preserveScroll: true }); };

    return (
        <AdminLayout title="Users" crumbs={[['Users']]}
            actions={<span className="text-sm text-gray-500">{totals.all} total · {totals.admins} admins · {totals.suspended} suspended</span>}>
            <Head title="Users" />
            <Panel>
                <div className="flex flex-wrap gap-3 border-b border-gray-100 p-4">
                    <div className="relative min-w-[14rem] flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input className={`${inputCls} pl-9`} placeholder="Search name or email" value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="Search users" />
                    </div>
                    <select className={`${inputCls} !w-auto`} value={f.role} onChange={(e) => set('role', e.target.value)} aria-label="Role"><option value="">All roles</option><option value="student">Students</option><option value="admin">Admins</option></select>
                    <select className={`${inputCls} !w-auto`} value={f.status} onChange={(e) => set('status', e.target.value)} aria-label="Status"><option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['User', 'Role', 'Groups', 'Last seen', 'Status', 'Actions'].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
                        <tbody>
                            {users.data.length === 0 && <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No users match these filters.</td></tr>}
                            {users.data.map((u) => {
                                const self = u.id === me.id;
                                return (
                                    <tr key={u.id} className="border-t border-gray-100">
                                        <td className="px-4 py-3"><div className="flex items-center gap-3"><img src={u.avatar_url} alt="" className="h-9 w-9 rounded-full" /><div><b>{u.name}{self && ' (you)'}</b><span className="block text-xs text-gray-500">{u.email}</span></div></div></td>
                                        <td className="px-4 py-3"><Badge tone={u.role === 'admin' ? 'dark' : 'green'}>{u.role}</Badge></td>
                                        <td className="px-4 py-3">{u.groups_count}</td>
                                        <td className="px-4 py-3 text-gray-500">{seen(u.last_seen_at)}</td>
                                        <td className="px-4 py-3">{u.is_suspended ? <Badge tone="pink">Suspended</Badge> : <Badge tone="green">Active</Badge>}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1.5">
                                                <Btn disabled={self} onClick={() => act('patch', 'admin.users.role', u.id, `Make ${u.name} ${u.role === 'admin' ? 'a student' : 'an admin'}?`, { role: u.role === 'admin' ? 'student' : 'admin' })}>{u.role === 'admin' ? 'Demote' : 'Make admin'}</Btn>
                                                <Btn disabled={self || u.role === 'admin'} onClick={() => act('patch', 'admin.users.suspend', u.id)}>{u.is_suspended ? 'Reinstate' : 'Suspend'}</Btn>
                                                <Btn tone="danger" disabled={self || u.role === 'admin'} onClick={() => act('delete', 'admin.users.destroy', u.id, `Permanently delete ${u.name} and their data?`)}>Delete</Btn>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Pager links={users.links} />
            </Panel>
        </AdminLayout>
    );
}
