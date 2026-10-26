import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import { Check, Copy, Download, Eye, File as FileIcon, Flag, Forward, Mic, Paperclip, Pencil, Reply, Save, Search, Send, Smile, X } from 'lucide-react';
import { api } from '@/lib/api';
import { inputCls } from '@/Layouts/AppLayout';
import EmojiPicker from '@/Components/chat/EmojiPicker';
import VoiceRecorder from '@/Components/chat/VoiceRecorder';
import { FilePickerDialog, ForwardDialog } from '@/Components/chat/ChatDialogs';

const IMG = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const AUDIO = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'webm'];
const TEXT = ['txt', 'md', 'csv', 'json', 'log', 'js', 'jsx', 'php', 'py', 'java', 'c', 'cpp', 'html', 'css', 'sql', 'xml'];
const ext = (n = '') => String(n).split('.').pop().toLowerCase();
const isImage = (n) => IMG.includes(ext(n));
const isVoice = (n) => String(n ?? '').startsWith('voice-') && AUDIO.includes(ext(n));
const canPreview = (n) => isImage(n) || ext(n) === 'pdf' || TEXT.includes(ext(n));
const bytes = (b) => (b ? (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.ceil(b / 1e3)} KB`) : '');
const openInReader = (m) => window.dispatchEvent(new CustomEvent('reader:open', { detail: { source: 'message', id: m.id } }));
const KINDS = { message: 'Message', comment: 'Comment', answer: 'Answer', suggestion: 'Suggestion' };

const Act = ({ onClick, label, danger = false, children }) => (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={`rounded p-1 opacity-70 transition hover:bg-black/10 hover:opacity-100 ${danger ? 'hover:text-[#C81E51]' : 'hover:text-[#0B8A94]'}`}>{children}</button>
);

async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back for http pages */ }
    const t = document.createElement('textarea');
    t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove(); return ok;
}

/** One chat bubble: my messages sit on the RIGHT (emerald), everyone else's on the LEFT (light). */
function Bubble({ m, me, threaded, onReply, onForward, nested = false }) {
    const mine = m.sender_id === me.id;
    const [editing, setEditing] = useState(false), [draft, setDraft] = useState(m.body ?? ''), [copied, setCopied] = useState(false), [saving, setSaving] = useState(false);
    const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const avatar = m.sender.avatar_url ?? `https://ui-avatars.com/api/?background=1B4322&color=fff&name=${encodeURIComponent(m.sender.name)}`;
    const preview = route('messages.preview', m.id, false);

    useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(t); }, [copied]);

    const saveEdit = () => {
        const body = draft.trim();
        if (!body || body === m.body) { setEditing(false); return; }
        setSaving(true);
        router.patch(route('messages.update', m.id), { body }, { preserveScroll: true, onSuccess: () => setEditing(false), onFinish: () => setSaving(false) });
    };

    return (
        <div id={`msg-${m.id}`} className={nested ? (mine ? 'mr-8 mt-2' : 'ml-8 mt-2') : ''}>
            <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                <img src={avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    <p className="mb-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                        {!mine && <b className="text-[#0A1F44]">{m.sender.name}</b>}
                        {m.kind !== 'message' && <span className="rounded bg-[#2EC4B6]/25 px-1.5 font-semibold text-[#7a5200]">{KINDS[m.kind]}</span>}
                        <span>{time}</span>{m.edited_at && <span className="italic">edited</span>}
                    </p>

                    <div className={`rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? 'rounded-br-sm bg-[#12315F] text-[#F5EFE6]' : 'rounded-bl-sm bg-[#DCE5F0] text-[#0A1F44]'}`}>
                        {m.forwarded_from && <p className="mb-1 flex items-center gap-1 text-[11px] italic opacity-80"><Forward size={11} aria-hidden="true" /> Forwarded from {m.forwarded_from}</p>}

                        {editing ? (
                            <div className="w-64 max-w-full">
                                <textarea autoFocus rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit message"
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') setEditing(false); }}
                                    className="w-full rounded-lg border-0 bg-white/90 p-2 text-sm text-[#0A1F44] focus:ring-2 focus:ring-[#2EC4B6]" />
                                <div className="mt-1 flex justify-end gap-2 text-xs">
                                    <button type="button" onClick={() => { setEditing(false); setDraft(m.body ?? ''); }} className="rounded px-2 py-1 hover:bg-white/10">Cancel</button>
                                    <button type="button" onClick={saveEdit} disabled={saving} className="rounded bg-[#2EC4B6] px-3 py-1 font-bold text-[#0A1F44] disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
                                </div>
                            </div>
                        ) : m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}

                        {m.attachment_name && isImage(m.attachment_name) && <img src={preview} alt={m.attachment_name} loading="lazy" className="mt-1 max-h-52 rounded-lg" />}
                        {m.attachment_name && isVoice(m.attachment_name) && <audio controls preload="metadata" src={preview} aria-label="Voice clip" className="mt-1 h-10 w-56 max-w-full" />}
                        {m.attachment_name && !isVoice(m.attachment_name) && (
                            <a href={route('messages.attachment', m.id)} className={`mt-1 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${mine ? 'border-white/30 hover:bg-white/10' : 'border-black/15 hover:bg-black/5'}`}>
                                <Download size={12} aria-hidden="true" /> {m.attachment_name}
                            </a>
                        )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-0.5 text-xs text-gray-500">
                        {threaded && !nested && <Act onClick={() => onReply(m)} label="Reply"><Reply size={14} /></Act>}
                        {m.body && <Act onClick={async () => setCopied(await copyText(m.body))} label={copied ? 'Copied' : 'Copy text'}>{copied ? <Check size={14} className="text-[#0B8A94]" /> : <Copy size={14} />}</Act>}
                        <Act onClick={() => onForward(m)} label="Forward"><Forward size={14} /></Act>
                        {mine && m.body && !editing && <Act onClick={() => { setDraft(m.body); setEditing(true); }} label="Edit"><Pencil size={14} /></Act>}
                        {threaded && m.attachment_name && canPreview(m.attachment_name) && <Act onClick={() => openInReader(m)} label="Preview together"><Eye size={14} /></Act>}
                        {m.attachment_name && !isVoice(m.attachment_name) && <Act onClick={() => router.post(route('messages.save', m.id), {}, { preserveScroll: true })} label="Save to Notes & Files"><Save size={14} /></Act>}
                        {!mine && <Act danger onClick={() => router.post(route('messages.flag', m.id), {}, { preserveScroll: true })} label="Report"><Flag size={14} /></Act>}
                        {copied && <span className="ml-1 text-[#0B8A94]" role="status">Copied</span>}
                    </div>
                </div>
            </div>
            {m.replies?.map((r) => <Bubble key={r.id} m={r} me={me} threaded={threaded} onReply={onReply} onForward={onForward} nested />)}
        </div>
    );
}

const draftKey = (url) => `sh-draft:${url}`;
const loadDraft = (url) => { try { return localStorage.getItem(draftKey(url)) || ''; } catch { return ''; } };
const saveDraft = (url, v) => { try { v ? localStorage.setItem(draftKey(url), v) : localStorage.removeItem(draftKey(url)); } catch { /* storage unavailable */ } };

/** Shared by group chat and DMs. `channel` is the private Echo channel name; `postUrl` the form target. */
export default function ChatPanel({ messages, channel, postUrl, only = ['messages'], threaded = false }) {
    const me = usePage().props.auth.user;
    const form = useForm({ body: loadDraft(postUrl), kind: 'message', parent_id: null, attachment: null });
    const [sendError, setSendError] = useState('');
    // an unsent message survives a refresh, a dropped connection or a closed tab
    useEffect(() => { saveDraft(postUrl, form.data.body); }, [postUrl, form.data.body]);
    useEffect(() => {
        const down = () => setSendError('Connection lost. Your message was not sent, but your text is kept. Press Send again when you are back online.');
        window.addEventListener('inertia:exception', down);
        return () => window.removeEventListener('inertia:exception', down);
    }, []);
    const [replyTo, setReplyTo] = useState(null);
    const [older, setOlder] = useState([]), [more, setMore] = useState(true), [loadingOlder, setLoadingOlder] = useState(false), [fetchedHistory, setFetchedHistory] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false), [q, setQ] = useState(''), [results, setResults] = useState(null);
    const [emojiOpen, setEmojiOpen] = useState(false), [recording, setRecording] = useState(false), [forwarding, setForwarding] = useState(null), [picking, setPicking] = useState(false);
    const [thumb, setThumb] = useState(null), [voiceError, setVoiceError] = useState('');
    const end = useRef(null), scroller = useRef(null), fileInput = useRef(null), textInput = useRef(null), stick = useRef(true);

    // Which conversation is this? (group.12 or dm.3.5) — used for search, older messages and "share from files".
    const dest = useMemo(() => {
        const g = /^group\.(\d+)$/.exec(channel ?? '');
        if (g) return { group_id: Number(g[1]) };
        const d = /^dm\.(\d+)\.(\d+)$/.exec(channel ?? '');
        if (d) return { user_id: Number(d[1]) === me.id ? Number(d[2]) : Number(d[1]) };
        return null;
    }, [channel, me.id]);

    // everything loaded so far: older pages + the latest page, oldest first
    const all = useMemo(() => {
        const map = new Map();
        [...older, ...messages].forEach((m) => map.set(m.id, m));
        return [...map.values()].sort((a, b) => a.id - b.id);
    }, [older, messages]);

    // a different conversation: start clean
    useEffect(() => { setOlder([]); setMore(true); setFetchedHistory(false); setResults(null); setSearchOpen(false); setQ(''); setReplyTo(null); stick.current = true; }, [channel]);

    // live updates: the event says "something new", Inertia refetches the latest messages
    useEffect(() => {
        if (!window.Echo || !channel) return;
        window.Echo.private(channel).listen('MessageSent', () => router.reload({ only }));
        return () => { window.Echo.leave(channel); };
    }, [channel]);

    useEffect(() => { if (stick.current) end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

    // preview of the attachment before it is sent
    useEffect(() => {
        const f = form.data.attachment;
        if (f && f.type.startsWith('image/')) {
            const url = URL.createObjectURL(f);
            setThumb(url);
            return () => URL.revokeObjectURL(url);
        }
        setThumb(null);
    }, [form.data.attachment]);

    /* ---------- infinite scroll (older messages) ---------- */
    const loadOlder = useCallback(async (until = null) => {
        if (!dest || loadingOlder || (!more && !until) || !all.length) return false;
        const el = scroller.current, prevH = el?.scrollHeight ?? 0, prevTop = el?.scrollTop ?? 0;
        setLoadingOlder(true);
        try {
            const d = await api('GET', route('messages.history', { ...dest, before: all[0].id, ...(until ? { until } : {}) }, false));
            setOlder((o) => [...d.messages, ...o]); setMore(d.more); setFetchedHistory(true);
            if (!until) requestAnimationFrame(() => { if (el) el.scrollTop = prevTop + (el.scrollHeight - prevH); });   // keep your place
            return true;
        } catch { return false; } finally { setLoadingOlder(false); }
    }, [dest, all, more, loadingOlder]);

    const onScroll = () => {
        const el = scroller.current; if (!el) return;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        if (el.scrollTop < 60 && more && !loadingOlder) loadOlder();
    };

    /* ---------- search ---------- */
    useEffect(() => {
        if (!searchOpen || !dest || q.trim().length < 2) { setResults(null); return; }
        let alive = true;
        const t = setTimeout(() => api('GET', route('messages.search', { ...dest, q }, false)).then((d) => alive && setResults(d.results)).catch(() => alive && setResults([])), 300);
        return () => { alive = false; clearTimeout(t); };
    }, [q, searchOpen, dest]);

    const jumpTo = async (id) => {
        let el = document.getElementById(`msg-${id}`);
        if (!el) { await loadOlder(id); await new Promise((r) => setTimeout(r, 80)); el = document.getElementById(`msg-${id}`); }
        if (!el) return;
        stick.current = false;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.add('ring-2', 'ring-[#2EC4B6]', 'rounded-xl');
        setTimeout(() => el.classList.remove('ring-2', 'ring-[#2EC4B6]', 'rounded-xl'), 1800);
    };

    /* ---------- composer ---------- */
    const clearFile = () => { form.setData('attachment', null); if (fileInput.current) fileInput.current.value = ''; };
    const send = (e) => {
        e.preventDefault();
        stick.current = true; setSendError('');
        form.transform((d) => ({ ...d, parent_id: replyTo?.id ?? null }));
        form.post(postUrl, {
        forceFormData: true, preserveScroll: true,
        onSuccess: () => { form.reset(); saveDraft(postUrl, ''); setReplyTo(null); if (fileInput.current) fileInput.current.value = ''; },
        onError: (errs) => setSendError(Object.values(errs)[0] || 'The message was not sent. Your text is kept, so you can try again.'),
});
    };
    const sendVoice = (file) => {
        stick.current = true; setVoiceError('');
        router.post(postUrl, { body: '', kind: 'message', parent_id: replyTo?.id ?? null, attachment: file }, {
            forceFormData: true, preserveScroll: true,
            onSuccess: () => { setRecording(false); setReplyTo(null); },
            onError: () => setVoiceError('The voice clip could not be sent (limit is 20 MB).'),
        });
    };
    const insertEmoji = (emoji) => {
        const el = textInput.current, v = form.data.body;
        const s = el?.selectionStart ?? v.length, e2 = el?.selectionEnd ?? v.length;
        form.setData('body', v.slice(0, s) + emoji + v.slice(e2));
        requestAnimationFrame(() => { if (el) { el.focus(); const p = s + emoji.length; el.setSelectionRange(p, p); } });
    };

    return (
        <div className="relative flex h-[32rem] flex-col rounded-xl border border-gray-200 bg-white">
            {/* search bar */}
            <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
                {searchOpen ? (<>
                    <Search size={15} className="text-gray-500" aria-hidden="true" />
                    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this chat" aria-label="Search this chat" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                    <button type="button" onClick={() => { setSearchOpen(false); setQ(''); setResults(null); }} aria-label="Close search" className="rounded p-1 hover:bg-black/10"><X size={16} /></button>
                </>) : (<>
                    <span className="flex-1 text-xs text-gray-500">{dest ? 'Scroll up for older messages' : ''}</span>
                    {dest && <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search this chat" title="Search this chat" className="rounded p-1.5 hover:bg-black/10"><Search size={16} /></button>}
                </>)}
            </div>
            {searchOpen && results !== null && (
                <div className="absolute inset-x-0 top-11 z-10 max-h-64 overflow-y-auto border-b border-gray-200 bg-[#F5EFE6] shadow-lg" role="listbox" aria-label="Search results">
                    {results.length === 0 && <p className="p-3 text-sm text-gray-500">No messages found.</p>}
                    {results.map((r) => (
                        <button key={r.id} type="button" role="option" onClick={() => jumpTo(r.thread_id)} className="block w-full border-b border-black/5 px-3 py-2 text-left text-sm hover:bg-black/5">
                            <span className="flex justify-between text-xs text-gray-500"><b className="text-[#0A1F44]">{r.sender}</b><span>{new Date(r.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
                            <span className="block truncate">{r.body || `📎 ${r.attachment_name}`}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* messages */}
            <div ref={scroller} onScroll={onScroll} className="flex-1 space-y-4 overflow-y-auto p-4">
                {loadingOlder && <p className="text-center text-xs text-gray-500" role="status">Loading older messages…</p>}
                {!more && fetchedHistory && <p className="text-center text-xs text-gray-500">This is the start of the conversation.</p>}
                {all.length === 0 && <p className="text-sm text-gray-500">No messages yet. Say hello.</p>}
                {all.map((m) => <Bubble key={m.id} m={m} me={me} threaded={threaded} onReply={setReplyTo} onForward={setForwarding} />)}
                <div ref={end} />
            </div>

            {/* composer */}
            <form onSubmit={send} className="border-t border-gray-200 p-3">
                {replyTo && <p className="mb-2 text-xs text-gray-500">Replying to {replyTo.sender_id === me.id ? 'yourself' : replyTo.sender.name} · <button type="button" onClick={() => setReplyTo(null)} className="underline">cancel</button></p>}
                {voiceError && <p role="alert" className="mb-2 text-xs text-[#C81E51]">{voiceError}</p>}

                {recording ? <VoiceRecorder onSend={sendVoice} onCancel={() => { setRecording(false); setVoiceError(''); }} /> : (
                    <div className="flex items-center gap-1.5">
                        {threaded && (
                            <select value={form.data.kind} onChange={(e) => form.setData('kind', e.target.value)} aria-label="Message type" className="rounded-lg border border-gray-300 text-sm">
                                {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        )}
                        <div className="relative">
                            <button type="button" onClick={() => setEmojiOpen((o) => !o)} aria-label="Emoji" title="Emoji" aria-expanded={emojiOpen} className="rounded-lg border border-gray-300 p-2 hover:bg-black/5"><Smile size={16} /></button>
                            {emojiOpen && <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />}
                        </div>
                        <input ref={textInput} value={form.data.body} onChange={(e) => form.setData('body', e.target.value)} placeholder="Type a message…" aria-label="Message" className={`${inputCls} min-w-0 flex-1`} />
                        <label className="flex cursor-pointer items-center rounded-lg border border-gray-300 p-2 hover:bg-black/5" title="Attach a file" aria-label="Attach a file">
                            <Paperclip size={16} /><input ref={fileInput} type="file" className="sr-only" onChange={(e) => form.setData('attachment', e.target.files[0] ?? null)} />
                        </label>
                        
                        <button type="button" onClick={() => setRecording(true)} aria-label="Record a voice clip" title="Voice clip" className="rounded-lg border border-gray-300 p-2 hover:bg-black/5"><Mic size={16} /></button>
                        <button disabled={form.processing} className="inline-flex items-center gap-2 rounded-lg bg-[#2EC4B6] px-4 py-2 text-sm font-bold text-[#0A1F44] transition-all hover:brightness-95 active:scale-95 disabled:opacity-60">
                            <Send size={15} aria-hidden="true" /> Send
                        </button>
                    </div>
                )}

                {sendError && <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{sendError}</p>}

                {form.data.attachment && !recording && (
                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 bg-black/5 p-2">
                        {thumb ? <img src={thumb} alt="Preview of the file you are sending" className="h-14 w-14 rounded-lg object-cover" />
                            : <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#12315F] text-[#2EC4B6]"><FileIcon size={22} aria-hidden="true" /></span>}
                        <span className="min-w-0 flex-1 text-sm"><b className="block truncate">{form.data.attachment.name}</b><span className="text-xs text-gray-500">{bytes(form.data.attachment.size)} · ready to send</span></span>
                        <button type="button" onClick={clearFile} aria-label="Remove attachment" className="rounded-full p-1.5 hover:bg-black/10"><X size={16} /></button>
                    </div>
                )}
                {form.errors.body && <p className="mt-1 text-xs text-[#C81E51]">{form.errors.body}</p>}
                {form.errors.attachment && <p className="mt-1 text-xs text-[#C81E51]">{form.errors.attachment}</p>}
            </form>

            {forwarding && <ForwardDialog message={forwarding} onClose={() => setForwarding(null)} />}
            {picking && dest && <FilePickerDialog dest={dest} onClose={() => setPicking(false)} />}
        </div>
    );
}
