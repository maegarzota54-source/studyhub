import { Head, router } from '@inertiajs/react';
import { CheckCircle2, Paperclip } from 'lucide-react';
import AdminLayout, { Badge, Btn, Panel } from '@/Layouts/AdminLayout';

export default function Reports({ flagged, history = [] }) {
    const go = (method, name, id, msg) => { if (!msg || confirm(msg)) router[method](route(name, id), {}, { preserveScroll: true }); };
    return (
        <AdminLayout title="Reports" crumbs={[['Reports']]} actions={<span className="text-sm text-gray-500">{flagged.length} open</span>}>
            <Head title="Reports" />
            {flagged.length === 0 ? (
                <Panel><div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-gray-500"><CheckCircle2 size={32} className="text-[#12315F]" /><p className="font-medium text-[#1F2937]">All clear</p><p className="text-sm">No reported messages need review.</p></div></Panel>
            ) : (
                <div className="space-y-4">
                    {flagged.map((m) => (
                        <Panel key={m.id}>
                            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm"><b>{m.sender.name}</b> <span className="text-gray-500">({m.sender.email})</span> {m.sender.is_suspended && <Badge tone="pink">Suspended</Badge>}</p>
                                    {m.reporter && <p className="text-xs text-gray-500">Reported by {m.reporter.name}{m.flagged_at ? ` · ${new Date(m.flagged_at).toLocaleString()}` : ''}</p>}
                                    <p className="text-xs text-gray-500">{m.group ? `In group “${m.group.title}”` : `Direct message to ${m.recipient?.name ?? 'a student'}`} · {new Date(m.created_at).toLocaleString()}</p>
                                    <blockquote className="mt-3 whitespace-pre-wrap break-words rounded-lg border-l-4 border-[#E30B5C] bg-gray-50 p-3 text-sm">
                                        {m.body || <span className="text-gray-500">(no text)</span>}
                                        {m.attachment_name && <span className="mt-2 flex items-center gap-1 text-xs text-gray-600"><Paperclip size={12} /> {m.attachment_name}</span>}
                                    </blockquote>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Btn onClick={() => go('post', 'admin.messages.clear', m.id)}>Dismiss</Btn>
                                    <Btn disabled={m.sender.is_suspended} onClick={() => go('patch', 'admin.users.suspend', m.sender.id, `Suspend ${m.sender.name}?`)}>Suspend sender</Btn>
                                    <Btn tone="danger" onClick={() => go('delete', 'admin.messages.destroy', m.id, 'Remove this message? A copy is kept in the moderation history.')}>Remove message</Btn>
                                </div>
                            </div>
                        </Panel>
                    ))}
                </div>
            )}

            <h2 className="mb-2 mt-8 text-base font-bold text-[#1F2937]">Moderation history</h2>
            <Panel>
                {history.length === 0 ? <p className="px-5 py-6 text-sm text-gray-500">No admin actions yet. Every action you take is recorded here, even after content is removed.</p> : (
                    <ul className="divide-y divide-gray-100">
                        {history.map((h) => (
                            <li key={h.id} className="px-5 py-3 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span><Badge>{h.action.replace('_', ' ')}</Badge> <span className="ml-1">{h.summary}</span></span>
                                    <span className="text-xs text-gray-500">{h.admin?.name ?? 'Admin'} · {new Date(h.created_at).toLocaleString()}</span>
                                </div>
                                {h.details?.body && <p className="mt-1 whitespace-pre-wrap break-words rounded bg-gray-50 p-2 text-xs text-gray-600">“{h.details.body}”{h.details.attachment_name ? ` 📎 ${h.details.attachment_name}` : ''}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </AdminLayout>
    );
}
