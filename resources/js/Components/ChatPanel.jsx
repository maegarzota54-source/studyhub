import { useEffect, useRef, useState } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import { Download, Flag, Paperclip, Reply, Save, Send } from 'lucide-react';
import { inputCls } from '@/Layouts/AppLayout';

const KINDS = { message: 'Message', comment: 'Comment', answer: 'Answer', suggestion: 'Suggestion' };

/** One chat bubble: my messages sit on the RIGHT (emerald), everyone else's on the LEFT (light). */
function Bubble({ m, me, threaded, onReply, nested = false }) {
    const mine = m.sender_id === me.id;
    const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const avatar = m.sender.avatar_url ?? `https://ui-avatars.com/api/?background=1B4322&color=fff&name=${encodeURIComponent(m.sender.name)}`;

    return (
        <div className={nested ? (mine ? 'mr-8 mt-2' : 'ml-8 mt-2') : ''}>
            <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                <img src={avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    <p className="mb-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                        {!mine && <b className="text-[#081C15]">{m.sender.name}</b>}
                        {m.kind !== 'message' && <span className="rounded bg-[#FBB02D]/25 px-1.5 font-semibold text-[#7a5200]">{KINDS[m.kind]}</span>}
                        <span>{time}</span>
                    </p>
                    <div className={`rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? 'rounded-br-sm bg-[#1B4322] text-[#EBF2FA]' : 'rounded-bl-sm bg-[#dbe7e0] text-[#081C15]'}`}>
                        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                        {m.attachment_name && (
                            <a href={route('messages.attachment', m.id)} className={`mt-1 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${mine ? 'border-white/30 hover:bg-white/10' : 'border-black/15 hover:bg-black/5'}`}>
                                <Download size={12} aria-hidden="true" /> {m.attachment_name}
                            </a>
                        )}
                    </div>
                    <div className="mt-1 flex gap-3 text-xs text-gray-500">
                        {threaded && !nested && <button onClick={() => onReply(m)} className="hover:text-[#038666]"><Reply size={12} className="inline" /> Reply</button>}
                        {m.attachment_name && <button onClick={() => router.post(route('messages.save', m.id), {}, { preserveScroll: true })} className="hover:text-[#038666]"><Save size={12} className="inline" /> Save to Notes & Files</button>}
                        {!mine && <button onClick={() => router.post(route('messages.flag', m.id), {}, { preserveScroll: true })} className="hover:text-[#C81E51]"><Flag size={12} className="inline" /> Report</button>}
                    </div>
                </div>
            </div>
            {m.replies?.map((r) => <Bubble key={r.id} m={r} me={me} threaded={threaded} onReply={onReply} nested />)}
        </div>
    );
}

/** Shared by group chat and DMs. `channel` is the private Echo channel name; `postUrl` the form target. */
export default function ChatPanel({ messages, channel, postUrl, only = ['messages'], threaded = false }) {
    const me = usePage().props.auth.user;
    const form = useForm({ body: '', kind: 'message', parent_id: null, attachment: null });
    const [replyTo, setReplyTo] = useState(null);
    const end = useRef(null);

    // live updates: the event says "something new", Inertia refetches the messages
    useEffect(() => {
        if (!window.Echo || !channel) return;
        window.Echo.private(channel).listen('MessageSent', () => router.reload({ only }));
        return () => { window.Echo.leave(channel); };
    }, [channel]);

    useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

    const send = (e) => {
        e.preventDefault();
        form.transform((d) => ({ ...d, parent_id: replyTo?.id ?? null })).post(postUrl, {
            forceFormData: true, preserveScroll: true,
            onSuccess: () => { form.reset(); setReplyTo(null); },
        });
    };

    return (
        <div className="flex h-[32rem] flex-col rounded-xl border border-gray-200 bg-white">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {messages.length === 0 && <p className="text-sm text-gray-500">No messages yet. Say hello.</p>}
                {messages.map((m) => <Bubble key={m.id} m={m} me={me} threaded={threaded} onReply={setReplyTo} />)}
                <div ref={end} />
            </div>
            <form onSubmit={send} className="border-t border-gray-200 p-3">
                {replyTo && <p className="mb-2 text-xs text-gray-500">Replying to {replyTo.sender_id === me.id ? 'yourself' : replyTo.sender.name} · <button type="button" onClick={() => setReplyTo(null)} className="underline">cancel</button></p>}
                <div className="flex gap-2">
                    {threaded && (
                        <select value={form.data.kind} onChange={(e) => form.setData('kind', e.target.value)} aria-label="Message type" className="rounded-lg border border-gray-300 text-sm">
                            {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    )}
                    <input value={form.data.body} onChange={(e) => form.setData('body', e.target.value)} placeholder="Type a message…" aria-label="Message" className={inputCls} />
                    <label className="flex cursor-pointer items-center rounded-lg border border-gray-300 px-3 hover:bg-black/5" title="Attach a file">
                        <Paperclip size={16} /><input type="file" className="sr-only" onChange={(e) => form.setData('attachment', e.target.files[0])} />
                    </label>
                    <button disabled={form.processing} className="inline-flex items-center gap-2 rounded-lg bg-[#FBB02D] px-4 py-2 text-sm font-bold text-[#081C15] transition-all hover:brightness-95 active:scale-95 disabled:opacity-60">
                        <Send size={15} aria-hidden="true" /> Send
                    </button>
                </div>
                {form.data.attachment && <p className="mt-1 text-xs text-gray-500">{form.data.attachment.name}</p>}
                {form.errors.body && <p className="mt-1 text-xs text-[#C81E51]">{form.errors.body}</p>}
            </form>
        </div>
    );
}