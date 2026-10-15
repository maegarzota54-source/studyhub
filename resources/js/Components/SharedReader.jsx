import { useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { BookOpen, ChevronLeft, ChevronRight, Download, File as FileIcon, FileText, Image as ImageIcon, X } from 'lucide-react';
import { api } from '@/lib/api';

const ICON = { pdf: FileText, image: ImageIcon, text: FileText, none: FileIcon };
const size = (b) => (b ? (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.ceil(b / 1e3)} KB`) : '');

/** Renders the file. The person presenting drives page / scroll; everyone else follows. */
function Viewer({ file, page, scroll, canControl, onScroll }) {
    const box = useRef(null), timer = useRef(null);
    const [text, setText] = useState(null);

    useEffect(() => {
        setText(null);
        if (file.kind !== 'text') return;
        let alive = true;
        fetch(file.url, { credentials: 'same-origin' }).then((r) => r.text()).then((t) => alive && setText(t.slice(0, 200000))).catch(() => alive && setText('Could not load this file.'));
        return () => { alive = false; };
    }, [file.id, file.kind]);

    useEffect(() => () => clearTimeout(timer.current), []);

    // followers: scroll to the presenter's position
    useEffect(() => {
        const el = box.current;
        if (!el || canControl) return;
        el.scrollTop = ((el.scrollHeight - el.clientHeight) * scroll) / 100;
    }, [scroll, text, canControl, file.id]);

    const handleScroll = () => {
        if (!canControl || !onScroll) return;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            const el = box.current; if (!el) return;
            const max = el.scrollHeight - el.clientHeight;
            onScroll(max > 0 ? Math.round((el.scrollTop / max) * 100) : 0);
        }, 350);
    };

    if (file.kind === 'pdf') return <iframe key={page} title={file.name} src={`${file.url}#page=${page}&toolbar=0&navpanes=0`} className="h-full w-full rounded-lg bg-white" />;
    if (file.kind === 'image') return <div ref={box} onScroll={handleScroll} className="h-full overflow-auto rounded-lg bg-[#081C15]"><img src={file.url} alt={file.name} className="w-full" /></div>;
    if (file.kind === 'text') return <pre ref={box} onScroll={handleScroll} className="h-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#EBF2FA] p-3 text-xs text-[#081C15]">{text ?? 'Loading…'}</pre>;
    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-[#081C15] p-4 text-center text-sm">
            <FileIcon size={32} color="#FBB02D" />
            <p>A preview isn't available for this file type.</p>
            <a href={file.download} className="inline-flex items-center gap-2 rounded-lg bg-[#FBB02D] px-3 py-2 font-semibold text-[#081C15]"><Download size={14} /> Download to read</a>
        </div>
    );
}

export default function SharedReader({ groupId }) {
    const me = usePage().props.auth.user;
    const [files, setFiles] = useState([]);
    const [reading, setReading] = useState(null);
    const [follow, setFollow] = useState(true);
    const [localPage, setLocalPage] = useState(1);
    const latest = useRef(null), presenting = useRef(false);
    const u = (name) => route(name, groupId, false);

    const isPresenter = !!reading && reading.by_id === me.id;
    latest.current = reading; presenting.current = isPresenter;

    // 1) pull the shared state every 2.5 s
    useEffect(() => {
        let alive = true;
        const pull = () => api('GET', route('groups.reader', groupId, false)).then((d) => {
            if (!alive) return;
            setFiles(d.files);
            // while I'm presenting, keep my own page/scroll so a slow response can't snap it back
            setReading((prev) => (prev && d.reading && prev.by_id === me.id && d.reading.by_id === me.id && prev.message_id === d.reading.message_id
                ? { ...d.reading, page: prev.page, scroll: prev.scroll } : d.reading));
        }).catch(() => {});
        pull();
        const id = setInterval(pull, 2500);
        return () => { alive = false; clearInterval(id); };
    }, [groupId]);

    // 2) tell the circle I'm in this chat (drives the green indicator)
    useEffect(() => {
        const beat = (active) => api('POST', route('groups.heartbeat', groupId, false), { active }).catch(() => {});
        beat(true);
        const id = setInterval(() => beat(true), 20000);
        return () => { clearInterval(id); beat(false); };
    }, [groupId]);

    // 3) presenter keep-alive, and stop sharing when leaving the page
    useEffect(() => {
        if (!isPresenter) return;
        const id = setInterval(() => { const r = latest.current; if (r) api('POST', route('groups.reader.sync', groupId, false), { page: r.page, scroll: r.scroll }).catch(() => {}); }, 20000);
        return () => clearInterval(id);
    }, [isPresenter, groupId]);
    useEffect(() => () => { if (presenting.current) api('DELETE', route('groups.reader.stop', groupId, false)).catch(() => {}); }, [groupId]);

    const open = (f) => {
        setFollow(true);
        setReading({ message_id: f.id, by_id: me.id, by: me.name, page: 1, scroll: 0, file: f });
        api('POST', route('groups.reader.open', groupId, false), { message_id: f.id }).catch(() => {});
    };
    const stop = () => { setReading(null); api('DELETE', route('groups.reader.stop', groupId, false)).catch(() => {}); };
    const goPage = (p) => {
        p = Math.max(1, p);
        if (isPresenter) { setReading((r) => ({ ...r, page: p })); api('POST', route('groups.reader.sync', groupId, false), { page: p, scroll: latest.current?.scroll ?? 0 }).catch(() => {}); }
        else setLocalPage(p);
    };
    const sendScroll = (s) => {
        setReading((r) => (r ? { ...r, scroll: s } : r));
        api('POST', route('groups.reader.sync', groupId, false), { page: latest.current?.page ?? 1, scroll: s }).catch(() => {});
    };

    const file = reading?.file;
    const canControl = isPresenter || !follow;
    const page = isPresenter || follow ? reading?.page ?? 1 : localPage;

    return (
        <section className="overflow-hidden rounded-2xl text-[#EBF2FA]" style={{ background: '#1B4322' }} aria-label="Reading together">
            <header className="flex items-center justify-between gap-2 px-4 py-3">
                <h2 className="flex items-center gap-2 font-semibold"><BookOpen size={18} color="#FBB02D" aria-hidden="true" /> Reading together</h2>
                {reading && (isPresenter
                    ? <button onClick={stop} className="flex items-center gap-1 rounded-full bg-[#FBB02D] px-3 py-1 text-xs font-bold text-[#081C15]"><X size={12} /> Stop sharing</button>
                    : <button onClick={() => { if (follow) setLocalPage(reading.page); setFollow(!follow); }} className="rounded-full border border-[#EBF2FA]/30 px-3 py-1 text-xs font-semibold hover:bg-white/10">{follow ? `Following ${reading.by}` : 'Follow again'}</button>)}
            </header>

            {reading && file ? (
                <div className="px-4 pb-4">
                    <p className="mb-2 flex items-center gap-2 text-xs text-[#EBF2FA]/80">
                        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FBB02D] opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FBB02D]" /></span>
                        {isPresenter ? 'You are sharing' : `${reading.by} is reading`}: <b className="truncate text-[#EBF2FA]">{file.name}</b>
                    </p>
                    {file.kind === 'pdf' && (
                        <div className="mb-2 flex items-center gap-2 text-xs">
                            {canControl ? (<>
                                <button onClick={() => goPage(page - 1)} disabled={page <= 1} aria-label="Previous page" className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20 disabled:opacity-40"><ChevronLeft size={16} /></button>
                                <span>Page {page}</span>
                                <button onClick={() => goPage(page + 1)} aria-label="Next page" className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><ChevronRight size={16} /></button>
                            </>) : <span>Page {page} (following {reading.by})</span>}
                        </div>
                    )}
                    <div className="h-72"><Viewer file={file} page={page} scroll={reading.scroll} canControl={canControl} onScroll={isPresenter ? sendScroll : null} /></div>
                </div>
            ) : (
                <p className="px-4 pb-3 text-sm text-[#EBF2FA]/80">Nothing is open. Open a file below and everyone in the circle sees what you are reading.</p>
            )}

            <div className="border-t border-white/10 px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#EBF2FA]/60">Files in this chat</p>
                {files.length === 0 && <p className="text-sm text-[#EBF2FA]/70">Attach a document in the chat to share it here.</p>}
                <ul className="max-h-44 space-y-1 overflow-y-auto">
                    {files.map((f) => { const Icon = ICON[f.kind]; const live = reading?.message_id === f.id; return (
                        <li key={f.id}>
                            <button onClick={() => open(f)} className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-white/10 ${live ? 'bg-white/10' : ''}`}>
                                <Icon size={16} color="#FBB02D" aria-hidden="true" />
                                <span className="min-w-0 flex-1"><span className="block truncate">{f.name}</span><span className="block text-xs text-[#EBF2FA]/60">{f.by} · {size(f.size)}</span></span>
                                {live ? <span className="text-xs font-semibold text-[#FBB02D]">Open</span> : <span className="text-xs text-[#EBF2FA]/60">Read together</span>}
                            </button>
                        </li>); })}
                </ul>
            </div>
        </section>
    );
}
