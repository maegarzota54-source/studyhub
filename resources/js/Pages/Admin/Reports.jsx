import { Head, router } from '@inertiajs/react';
import { CheckCircle2, Paperclip } from 'lucide-react';
import AdminLayout, { Badge, Btn, Panel } from '@/Layouts/AdminLayout';

export default function Reports({ flagged }) {
    const go = (method, name, id, msg) => { if (!msg || confirm(msg)) router[method](route(name, id), {}, { preserveScroll: true }); };
    return (
        <AdminLayout title="Reports" crumbs={[['Reports']]} actions={<span className="text-sm text-gray-500">{flagged.length} open</span>}>
            <Head title="Reports" />
            {flagged.length === 0 ? (
                <Panel><div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-gray-500"><CheckCircle2 size={32} className="text-[#355E3B]" /><p className="font-medium text-[#1F2937]">All clear</p><p className="text-sm">No reported messages need review.</p></div></Panel>
            ) : (
                <div className="space-y-4">
                    {flagged.map((m) => (
                        <Panel key={m.id}>
                            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm"><b>{m.sender.name}</b> <span className="text-gray-500">({m.sender.email})</span> {m.sender.is_suspended && <Badge tone="pink">Suspended</Badge>}</p>
                                    <p className="text-xs text-gray-500">{m.group ? `In group “${m.group.title}”` : `Direct message to ${m.recipient?.name ?? 'a student'}`} · {new Date(m.created_at).toLocaleString()}</p>
                                    <blockquote className="mt-3 whitespace-pre-wrap break-words rounded-lg border-l-4 border-[#E30B5C] bg-gray-50 p-3 text-sm">
                                        {m.body || <span className="text-gray-500">(no text)</span>}
                                        {m.attachment_name && <span className="mt-2 flex items-center gap-1 text-xs text-gray-600"><Paperclip size={12} /> {m.attachment_name}</span>}
                                    </blockquote>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Btn onClick={() => go('post', 'admin.messages.clear', m.id)}>Dismiss</Btn>
                                    <Btn disabled={m.sender.is_suspended} onClick={() => go('patch', 'admin.users.suspend', m.sender.id, `Suspend ${m.sender.name}?`)}>Suspend sender</Btn>
                                    <Btn tone="danger" onClick={() => go('delete', 'admin.messages.destroy', m.id, 'Remove this message permanently?')}>Remove message</Btn>
                                </div>
                            </div>
                        </Panel>
                    ))}
                </div>
            )}
        </AdminLayout>
    );
}
