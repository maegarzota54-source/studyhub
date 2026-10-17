import { Head, Link } from '@inertiajs/react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Clock, Flag, Layers, MessageSquare, UserCheck, Users } from 'lucide-react';
import AdminLayout, { Badge, Kpi, Panel } from '@/Layouts/AdminLayout';

const DOT = { user: '#355E3B', group: '#1F2937', report: '#E30B5C' };

export default function Dashboard({ kpis: k, chart, topGroups, recentUsers, feed, openReports }) {
    return (
        <AdminLayout title="Dashboard" crumbs={[['Dashboard']]}
            actions={<span className="text-sm text-gray-500">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span>}>
            <Head title="Admin dashboard" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Kpi label="Total users" value={k.users} sub={`+${k.users_week} this week · ${k.suspended} suspended`} Icon={Users} href={route('admin.users')} />
                <Kpi label="Active today" value={k.active_today} sub="Users seen since midnight" Icon={UserCheck} tone="#4a7c52" href={route('admin.users')} />
                <Kpi label="Study groups" value={k.groups} sub={`+${k.groups_week} this week`} Icon={Layers} tone="#1F2937" href={route('admin.groups')} />
                <Kpi label="Study hours logged" value={k.hours} sub={`${k.hours_week} h in the last 7 days`} Icon={Clock} href={route('admin.index')} />
                <Kpi label="Messages sent" value={k.messages} sub={`+${k.messages_week} this week`} Icon={MessageSquare} tone="#4a7c52" href={route('admin.content')} />
                <Kpi label="Open reports" value={openReports} sub="Flagged content to review" Icon={Flag} tone="#E30B5C" href={route('admin.reports')} />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
                <Panel title="Sign-ups and messages (14 days)" className="xl:col-span-2">
                    <div className="h-72 p-4">
                        <ResponsiveContainer>
                            <AreaChart data={chart}>
                                <defs>
                                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#355E3B" stopOpacity={0.35} /><stop offset="95%" stopColor="#355E3B" stopOpacity={0} /></linearGradient>
                                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#E30B5C" stopOpacity={0.3} /><stop offset="95%" stopColor="#E30B5C" stopOpacity={0} /></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={1} /><YAxis allowDecimals={false} width={30} tick={{ fontSize: 11 }} />
                                <Tooltip /><Legend />
                                <Area type="monotone" dataKey="signups" name="Sign-ups" stroke="#355E3B" fill="url(#g1)" strokeWidth={2} />
                                <Area type="monotone" dataKey="messages" name="Messages" stroke="#E30B5C" fill="url(#g2)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                <Panel title="Study hours per day">
                    <div className="h-72 p-4">
                        <ResponsiveContainer>
                            <BarChart data={chart}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={2} /><YAxis width={30} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v) => [`${v} h`, 'Hours']} />
                                <Bar dataKey="hours" fill="#355E3B" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                <Panel title="Most active groups" className="xl:col-span-2" action={<Link href={route('admin.groups')} className="text-sm text-[#355E3B] hover:underline">View all</Link>}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="px-5 py-2 font-medium">Group</th><th className="px-3 py-2 font-medium">Owner</th><th className="px-3 py-2 font-medium">Members</th><th className="px-3 py-2 font-medium">Messages</th></tr></thead>
                            <tbody>
                                {topGroups.length === 0 && <tr><td colSpan="4" className="px-5 py-6 text-center text-gray-500">No groups yet.</td></tr>}
                                {topGroups.map((g) => (
                                    <tr key={g.id} className="border-t border-gray-100">
                                        <td className="px-5 py-3"><b>{g.title}</b><span className="block text-xs text-gray-500">{g.topic}</span></td>
                                        <td className="px-3 py-3">{g.owner?.name}</td>
                                        <td className="px-3 py-3">{g.members_count}/{g.max_members}</td>
                                        <td className="px-3 py-3">{g.messages_count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <Panel title="Recent activity">
                    <ul className="divide-y divide-gray-100">
                        {feed.length === 0 && <li className="px-5 py-6 text-center text-sm text-gray-500">Nothing yet.</li>}
                        {feed.map((e, i) => (
                            <li key={i} className="flex gap-3 px-5 py-3 text-sm">
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[e.type] }} />
                                <span className="flex-1">{e.text}<span className="block text-xs text-gray-400">{e.ago}</span></span>
                            </li>
                        ))}
                    </ul>
                </Panel>

                <Panel title="Newest users" className="xl:col-span-3" action={<Link href={route('admin.users')} className="text-sm text-[#355E3B] hover:underline">Manage users</Link>}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <tbody>
                                {recentUsers.map((u) => (
                                    <tr key={u.id} className="border-t border-gray-100 first:border-0">
                                        <td className="flex items-center gap-3 px-5 py-3"><img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full" />{u.name}</td>
                                        <td className="px-3 py-3 text-gray-500">{u.email}</td>
                                        <td className="px-3 py-3"><Badge tone={u.role === 'admin' ? 'dark' : 'green'}>{u.role}</Badge></td>
                                        <td className="px-3 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            </div>
        </AdminLayout>
    );
}
