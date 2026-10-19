import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import { Check, Download, Eye, Flag, MoreHorizontal, Paperclip, Pencil, Reply, Save, Send, Smile, Trash2, X } from 'lucide-react';
import { inputCls } from '@/Layouts/AppLayout';
import FilePreviewModal from '@/Components/FilePreviewModal';
import { api } from '@/lib/api';

const KINDS = { message: 'Message', comment: 'Comment', answer: 'Answer', suggestion: 'Suggestion' };
const REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏'];

/** One chat bubble: my messages sit on the RIGHT (emerald), everyone else's on the LEFT (light). */
function Bubble({ m, me, threaded, onReply, latestOwnMessageId, nested = false }) {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const editForm = useForm({ body: m.body ?? '' });
    const mine = m.sender_id === me.id;
    const canReact = /^\d+$/.test(String(m.id));
    const canEdit = mine && m.kind !== 'call' && canReact;
    const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const avatar = m.sender.avatar_url ?? `https://ui-avatars.com/api/?background=1B4322&color=fff&name=${encodeURIComponent(m.sender.name)}`;
    const reactionGroups = Object.values((m.reactions ?? []).reduce((groups, user) => {
        const emoji = user.pivot?.emoji;
        if (!emoji) return groups;
        groups[emoji] ??= { emoji, users: [], mine: false };
        groups[emoji].users.push(user.name);
        if (user.id === me.id) groups[emoji].mine = true;
        return groups;
    }, {}));
    const readBy = m.read_by ?? [];
    const deliveredBy = m.delivered_by ?? [];
    const receiptLabel = readBy.length
        ? `Seen by ${readBy.length}`
        : deliveredBy.length
            ? (threaded ? `Delivered to ${deliveredBy.length}` : 'Delivered')
            : 'Sent';
    const react = (emoji) => {
        setReactionPickerOpen(false);
        router.post(route('messages.react', m.id), { emoji }, { preserveScroll: true });
    };

    return (
        <div className={`group/message relative ${nested ? (mine ? 'mr-8 mt-2' : 'ml-8 mt-2') : ''}`}>
            <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                <img src={avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    <p className="mb-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                        {!mine && <b className="text-[#081C15]">{m.sender.name}</b>}
                        {m.kind !== 'message' && <span className="rounded bg-[#FBB02D]/25 px-1.5 font-semibold text-[#7a5200]">{KINDS[m.kind]}</span>}
                        <span>{time}{m.edited_at && ' · edited'}</span>
                    </p>
                    {editing ? (
                        <form onSubmit={(event) => {
                            event.preventDefault();
                            editForm.patch(route('messages.update', m.id), {
                                preserveScroll: true,
                                onSuccess: () => setEditing(false),
                            });
                        }} className={`w-full rounded-2xl p-2 shadow-sm ${mine ? 'bg-[#1B4322]' : 'bg-[#dbe7e0]'}`}>
                            <textarea autoFocus rows={3} maxLength={5000} value={editForm.data.body}
                                onChange={(event) => editForm.setData('body', event.target.value)}
                                aria-label="Edit message" className="w-full resize-y rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900" />
                            {editForm.errors.body && <p className={`mt-1 text-xs ${mine ? 'text-rose-200' : 'text-rose-700'}`}>{editForm.errors.body}</p>}
                            <div className="mt-1 flex justify-end gap-1">
                                <button type="button" onClick={() => { setEditing(false); editForm.clearErrors(); }}
                                    className="rounded-lg p-1.5 text-white hover:bg-white/10" aria-label="Cancel edit">
                                    <X size={15} aria-hidden="true" />
                                </button>
                                <button type="submit" disabled={editForm.processing}
                                    className="rounded-lg p-1.5 text-white hover:bg-white/10 disabled:opacity-50" aria-label="Save edit">
                                    <Check size={15} aria-hidden="true" />
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className={`rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? 'rounded-br-sm bg-[#1B4322] text-[#EBF2FA]' : 'rounded-bl-sm bg-[#dbe7e0] text-[#081C15]'}`}>
                            {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                            {m.attachment_name && (
                                <div className="mt-1">
                                    <a href={route('messages.attachment', m.id)} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${mine ? 'border-white/30 hover:bg-white/10' : 'border-black/15 hover:bg-black/5'}`}>
                                        <Download size={12} aria-hidden="true" /> {m.attachment_name}
                                    </a>
                                    <button type="button" onClick={() => setPreviewOpen(true)}
                                        className={`ml-2 inline-flex items-center gap-1 text-xs underline ${mine ? 'text-white/80' : 'text-[#038666]'}`}>
                                        <Eye size={12} aria-hidden="true" /> Preview
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {reactionGroups.length > 0 && (
                        <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                            {reactionGroups.map(({ emoji, users, mine: reacted }) => (
                                <button key={emoji} type="button" onClick={() => canReact && react(emoji)}
                                    disabled={!canReact} aria-pressed={reacted} title={users.join(', ')}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${reacted ? 'border-[#038666]/40 bg-[#038666]/10 text-[#075e4b]' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'} disabled:cursor-default`}>
                                    <span>{emoji}</span><span>{users.length}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {mine && canReact && m.id === latestOwnMessageId && (
                        <details className={`mt-1 max-w-full text-[11px] text-gray-500 ${mine ? 'text-right' : ''}`}>
                            <summary className="cursor-pointer list-none">{receiptLabel}</summary>
                            {(readBy.length > 0 || deliveredBy.length > 0) && (
                                <div className="mt-1 space-y-1 rounded-lg border border-gray-200 bg-white p-2 text-left shadow-sm">
                                    {(readBy.length > 0 ? readBy : deliveredBy).map((user) => (
                                        <div key={user.id} className="flex items-center gap-2 whitespace-nowrap">
                                            <img src={user.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                                            <span>{user.name}</span>
                                            {readBy.some((reader) => reader.id === user.id) && <span className="text-[#038666]">Seen</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </details>
                    )}
                </div>
            </div>
            {canReact && <div className={`absolute ${mine ? 'right-10' : 'left-10'} top-0 z-20 flex -translate-y-full items-center gap-0.5 rounded-full border border-gray-200 bg-white/95 p-1 text-gray-600 shadow-lg backdrop-blur transition-opacity sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100`}>
                {threaded && !nested && (
                    <button type="button" onClick={() => onReply(m)} aria-label={`Reply to ${m.sender.name}`} title="Reply"
                        className="rounded-full p-1.5 hover:bg-gray-100 hover:text-[#038666]">
                        <Reply size={16} aria-hidden="true" />
                    </button>
                )}
                {canReact && (
                    <div className="relative">
                        <button type="button" onClick={() => setReactionPickerOpen((open) => !open)} aria-label="Add reaction" aria-expanded={reactionPickerOpen} title="React"
                            className="rounded-full p-1.5 hover:bg-gray-100 hover:text-[#038666]">
                            <Smile size={16} aria-hidden="true" />
                        </button>
                        {reactionPickerOpen && (
                            <div className="absolute left-1/2 top-full mt-1 flex -translate-x-1/2 gap-1 rounded-full border border-gray-200 bg-white p-1.5 shadow-xl" aria-label="Choose a reaction">
                                {REACTIONS.map((emoji) => (
                                    <button key={emoji} type="button" onClick={() => react(emoji)} aria-label={`React ${emoji}`}
                                        className="rounded-full p-1.5 text-lg transition-transform hover:scale-125 hover:bg-gray-100">
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <div className="relative">
                    <button type="button" onClick={() => setMoreOpen((open) => !open)} aria-label="More message actions" aria-expanded={moreOpen} title="More"
                        className="rounded-full p-1.5 hover:bg-gray-100 hover:text-[#038666]">
                        <MoreHorizontal size={16} aria-hidden="true" />
                    </button>
                    {moreOpen && (
                        <div className={`absolute ${mine ? 'right-0' : 'left-0'} top-full mt-1 min-w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-left text-sm text-gray-700 shadow-xl`}>
                            {m.attachment_name && <button type="button" onClick={() => { setMoreOpen(false); router.post(route('messages.save', m.id), {}, { preserveScroll: true }); }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50"><Save size={14} /> Save to Notes &amp; Files</button>}
                            {!mine && canReact && <button type="button" onClick={() => { setMoreOpen(false); router.post(route('messages.flag', m.id), {}, { preserveScroll: true }); }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50"><Flag size={14} /> Report message</button>}
                            {canEdit && <button type="button" onClick={() => { setMoreOpen(false); editForm.setData('body', m.body ?? ''); setEditing(true); }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50"><Pencil size={14} /> Edit message</button>}
                            {canReact && <button type="button" onClick={() => { setMoreOpen(false); if (window.confirm('Remove this message from your chat only?')) router.delete(route('messages.hide', m.id), { preserveScroll: true }); }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50"><Trash2 size={14} /> Unsend for me</button>}
                            {mine && canReact && <button type="button" onClick={() => { setMoreOpen(false); if (window.confirm('Unsend this message for everyone?')) router.delete(route('messages.unsend', m.id), { preserveScroll: true }); }} className="flex w-full items-center gap-2 px-3 py-2 text-[#C81E51] hover:bg-rose-50"><Trash2 size={14} /> Unsend for everyone</button>}
                        </div>
                    )}
                </div>
            </div>}
            {m.replies?.map((r) => <Bubble key={r.id} m={r} me={me} threaded={threaded} onReply={onReply} latestOwnMessageId={latestOwnMessageId} nested />)}
            {previewOpen && m.attachment_name && (
                <FilePreviewModal
                    item={{
                        title: m.attachment_name,
                        preview: m.attachment_preview,
                        preview_url: route('messages.preview', m.id),
                    }}
                    downloadUrl={route('messages.attachment', m.id)}
                    onClose={() => setPreviewOpen(false)}
                />
            )}
        </div>
    );
}

/** Shared by group chat and DMs. `channel` is the private Echo channel name; `postUrl` the form target. */
export default function ChatPanel({ messages, channel, postUrl, only = ['messages'], threaded = false }) {
    const me = usePage().props.auth.user;
    const form = useForm({ body: '', kind: 'message', parent_id: null, attachment: null });
    const [replyTo, setReplyTo] = useState(null);
    const [pendingMessages, setPendingMessages] = useState([]);
    const end = useRef(null);
    const chatList = useRef(null);
    const wasAtBottom = useRef(true);
    const reloadingMessages = useRef(false);
    const sendingMessage = useRef(false);
    const receiptProgress = useRef({ delivered: 0, read: 0 });
    const visibleMessages = [
        ...messages,
        ...pendingMessages.filter((pending) => !messages.some((message) =>
            message.sender_id === pending.sender_id
            && message.body === pending.body
            && message.kind === pending.kind
            && new Date(message.created_at).getTime() >= new Date(pending.created_at).getTime() - 5000
        )),
    ];
    const persistedMessages = visibleMessages.flatMap((message) => [message, ...(message.replies ?? [])])
        .filter((message) => /^\d+$/.test(String(message.id)));
    const latestMessageId = persistedMessages.reduce((latest, message) => Math.max(latest, Number(message.id)), 0);
    const latestOwnMessageId = persistedMessages
        .filter((message) => message.sender_id === me.id)
        .reduce((latest, message) => Math.max(latest, Number(message.id)), 0);
    const visibleMessageCount = visibleMessages.reduce((count, message) => count + 1 + (message.replies?.length ?? 0), 0);

    const sendReceipt = useCallback((messageId, status) => {
        const current = receiptProgress.current[status];
        if (messageId <= current) return;

        receiptProgress.current[status] = messageId;
        api('POST', route('messages.receipts'), { message_id: messageId, status })
            .catch((error) => {
                if (receiptProgress.current[status] === messageId) receiptProgress.current[status] = current;
                console.error(`Unable to update chat ${status} receipt.`, error);
            });
    }, []);

    const updateReadReceiptAtBottom = useCallback(() => {
        const list = chatList.current;
        if (!list) return;
        wasAtBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight <= 80;
        if (wasAtBottom.current && !document.hidden && latestMessageId) sendReceipt(latestMessageId, 'read');
    }, [latestMessageId, sendReceipt]);

    useEffect(() => {
        receiptProgress.current = { delivered: 0, read: 0 };
    }, [channel]);

    // Poll as a fallback because broadcasting is optional and disabled in the default setup.
    useEffect(() => {
        const reloadMessages = () => {
            if (reloadingMessages.current || sendingMessage.current) return;
            reloadingMessages.current = true;
            router.reload({
                only,
                preserveScroll: true,
                onFinish: () => { reloadingMessages.current = false; },
            });
        };
        const timer = window.setInterval(reloadMessages, 3000);

        if (window.Echo && channel) {
            window.Echo.private(channel).listen('MessageSent', reloadMessages);
        }
        return () => {
            window.clearInterval(timer);
            if (window.Echo && channel) window.Echo.leave(channel);
            reloadingMessages.current = false;
        };
    }, [channel]);

    useEffect(() => {
        if (wasAtBottom.current) end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }, [visibleMessageCount]);

    useEffect(() => {
        const list = chatList.current;
        const atBottom = list && list.scrollHeight - list.scrollTop - list.clientHeight <= 80;
        if (!document.hidden && latestMessageId) sendReceipt(latestMessageId, atBottom ? 'read' : 'delivered');
        updateReadReceiptAtBottom();
    }, [channel, latestMessageId, sendReceipt, updateReadReceiptAtBottom]);

    useEffect(() => {
        const updateWhenVisible = () => {
            if (!document.hidden && latestMessageId) {
                const list = chatList.current;
                const atBottom = list && list.scrollHeight - list.scrollTop - list.clientHeight <= 80;
                sendReceipt(latestMessageId, atBottom ? 'read' : 'delivered');
                updateReadReceiptAtBottom();
            }
        };
        document.addEventListener('visibilitychange', updateWhenVisible);
        return () => document.removeEventListener('visibilitychange', updateWhenVisible);
    }, [latestMessageId, sendReceipt, updateReadReceiptAtBottom]);

    const send = (e) => {
        e.preventDefault();
        wasAtBottom.current = true;
        const optimisticId = `pending-${Date.now()}-${Math.random()}`;
        const optimistic = {
            id: optimisticId,
            sender_id: me.id,
            sender: { id: me.id, name: me.name, avatar_url: me.avatar_url },
            body: form.data.body,
            kind: form.data.kind,
            parent_id: replyTo?.id ?? null,
            attachment_name: form.data.attachment?.name ?? null,
            created_at: new Date().toISOString(),
            replies: [],
        };
        setPendingMessages((current) => [...current, optimistic]);
        sendingMessage.current = true;
        form.transform((d) => ({ ...d, parent_id: replyTo?.id ?? null }));
        form.post(postUrl, {
            forceFormData: true, preserveScroll: true,
            onSuccess: () => {
                setPendingMessages((current) => current.filter((message) => message.id !== optimisticId));
                form.reset();
                setReplyTo(null);
            },
            onError: () => setPendingMessages((current) => current.filter((message) => message.id !== optimisticId)),
            onCancel: () => setPendingMessages((current) => current.filter((message) => message.id !== optimisticId)),
            onFinish: () => { sendingMessage.current = false; },
        });
    };

    return (
        <div className="flex h-[min(32rem,65dvh)] min-h-80 flex-col rounded-xl border border-gray-200 bg-white sm:h-[32rem]">
            <div ref={chatList} onScroll={updateReadReceiptAtBottom} className="flex-1 space-y-4 overflow-y-auto p-4">
                {visibleMessages.length === 0 && <p className="text-sm text-gray-500">No messages yet. Say hello.</p>}
                {visibleMessages.map((m) => <Bubble key={m.id} m={m} me={me} threaded={threaded} onReply={setReplyTo} latestOwnMessageId={latestOwnMessageId} />)}
                <div ref={end} />
            </div>
            <form onSubmit={send} className="border-t border-gray-200 p-3">
                {replyTo && <p className="mb-2 text-xs text-gray-500">Replying to {replyTo.sender_id === me.id ? 'yourself' : replyTo.sender.name} · <button type="button" onClick={() => setReplyTo(null)} className="underline">cancel</button></p>}
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 sm:flex">
                    {threaded && (
                        <select value={form.data.kind} onChange={(e) => form.setData('kind', e.target.value)} aria-label="Message type" className="col-span-3 w-full rounded-lg border border-gray-300 text-sm sm:col-span-1 sm:w-auto">
                            {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    )}
                    <input value={form.data.body} onChange={(e) => form.setData('body', e.target.value)} placeholder="Type a message…" aria-label="Message" className={`${inputCls} min-w-0`} />
                    <label className="flex cursor-pointer items-center rounded-lg border border-gray-300 px-3 hover:bg-black/5" title="Attach a file">
                        <Paperclip size={16} /><input type="file" className="sr-only" onChange={(e) => form.setData('attachment', e.target.files[0])} />
                    </label>
                    <button disabled={form.processing} className="inline-flex items-center gap-2 rounded-lg bg-[#FBB02D] px-4 py-2 text-sm font-bold text-[#081C15] transition-all hover:brightness-95 active:scale-95 disabled:opacity-60">
                        <Send size={15} aria-hidden="true" /> <span className="hidden sm:inline">Send</span>
                    </button>
                </div>
                {form.data.attachment && <p className="mt-1 text-xs text-gray-500">{form.data.attachment.name}</p>}
                {form.errors.body && <p className="mt-1 text-xs text-[#C81E51]">{form.errors.body}</p>}
            </form>
        </div>
    );
}