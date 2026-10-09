import { useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, CalendarDays, FolderOpen, LineChart, MessageSquare, Send, Video } from 'lucide-react';
import ShStyle from '@/Components/ShStyle';


const SUBJECTS = [
    { n: 'Information Assurance security', tone: '#355E3B' }, { n: 'System Integration and Architecture', tone: '#4a7c52' }, { n: 'Project Management', tone: '#1F2937' },
    { n: 'Logic Programming', tone: '#C81E51' }, { n: 'Networking', tone: '#E30B5C' },
];

const TABS = [
    { id: 'chat', label: 'Chat and calls', Icon: MessageSquare, blurb: 'Group chat with threaded replies, file sharing and video calls. See who is online.' },
    { id: 'files', label: 'Notes and files', Icon: FolderOpen, blurb: 'Save anything from a chat straight into your circle\'s shared library.' },
    { id: 'schedule', label: 'Schedule', Icon: CalendarDays, blurb: 'Plan sessions for the whole circle, or just for the people who need them.' },
    { id: 'progress', label: 'Progress', Icon: LineChart, blurb: 'Log study time with a timer and watch your week add up.' },
];

function ChatPreview() {
    const [msgs, setMsgs] = useState([
        { n: 'Mark', t: "Let's meet at 10 AM today!" }, { n: 'Anna', t: "Okay! I'll share the notes." }, { n: 'John', t: 'Great! See you all.' },
    ]);
    const [v, setV] = useState('');
    const send = (e) => { e.preventDefault(); if (!v.trim()) return; setMsgs([...msgs, { n: 'You', t: v.trim(), me: true }]); setV(''); };
    return (
        <div className="flex h-full flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {msgs.map((m, i) => (
                    <div key={i} className={`sh-fade flex ${m.me ? 'justify-end' : ''}`}>
                        <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm" style={{ background: m.me ? '#355E3B' : '#F3F4F6', color: m.me ? '#fff' : '#1F2937' }}>
                            {!m.me && <b className="mb-0.5 block text-xs text-[#C81E51]">{m.n}</b>}{m.t}
                        </div>
                    </div>
                ))}
                <div className="flex items-center gap-1 text-gray-400" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className="sh-dot h-1.5 w-1.5 rounded-full bg-gray-400" style={{ animationDelay: `${i * 0.2}s` }} />)}</div>
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-gray-100 p-3">
                <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Try typing a message" className="sh-input !py-2 text-sm" aria-label="Message" />
                <button className="sh-btn sh-btn-accent !px-3" aria-label="Send"><Send size={16} /></button>
                <span className="sh-btn sh-btn-ghost !px-3" aria-hidden="true"><Video size={16} /></span>
            </form>
        </div>
    );
}

function FilesPreview() {
    const [saved, setSaved] = useState({});
    const files = [['Physics_Notes.pdf', '2.4 MB'], ['Study_Guide.docx', '1.1 MB'], ['Group_Presentation.pptx', '3.8 MB']];
    return (
        <div className="space-y-2 p-4">
            <p className="text-xs text-gray-500">Attachments from chat. Tap to save.</p>
            {files.map(([f, s]) => (
                <div key={f} className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
                    <div><p className="text-sm font-medium">{f}</p><p className="text-xs text-gray-500">{s}</p></div>
                    <button onClick={() => setSaved({ ...saved, [f]: !saved[f] })} className={`sh-btn !px-3 !py-1.5 !text-xs ${saved[f] ? 'sh-btn-primary' : 'sh-btn-ghost'}`}>
                        {saved[f] ? 'Saved to Notes & Files' : 'Save to Notes & Files'}
                    </button>
                </div>
            ))}
        </div>
    );
}

function SchedulePreview() {
    const [events, setEvents] = useState([{ t: 'Math Study Group', time: '10:00 AM', pub: true }, { t: 'Programming Group', time: '2:00 PM', pub: true }, { t: 'Solo revision', time: '7:00 PM', pub: false }]);
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return (
        <div className="p-4">
            <div className="mb-4 grid grid-cols-7 gap-1 text-center text-xs">
                {days.map((d, i) => <span key={i} className={`rounded-lg py-2 ${i === 3 ? 'bg-[#E30B5C] font-bold text-white' : 'bg-[#F3F4F6]'}`}>{d}<br />{i + 1}</span>)}
            </div>
            <p className="mb-2 text-xs text-gray-500">Tap a badge to change who can see the session.</p>
            {events.map((e, i) => (
                <div key={e.t} className="mb-2 flex items-center justify-between rounded-xl border border-gray-200 p-3">
                    <div><p className="text-sm font-medium">{e.t}</p><p className="text-xs text-gray-500">{e.time}</p></div>
                    <button onClick={() => setEvents(events.map((x, j) => (j === i ? { ...x, pub: !x.pub } : x)))}
                        className="rounded-full px-3 py-1 text-xs font-semibold transition-colors" style={{ background: e.pub ? '#d6e5d9' : '#fde7ef', color: e.pub ? '#2a4a2f' : '#C81E51' }}>
                        {e.pub ? 'Public: whole circle' : 'Private: only me'}
                    </button>
                </div>
            ))}
        </div>
    );
}

function ProgressPreview() {
    const hrs = [1.5, 2, 1, 3, 2.5, 4, 1.2];
    const [hover, setHover] = useState(null);
    const total = hrs.reduce((a, b) => a + b, 0).toFixed(1);
    return (
        <div className="p-4">
            <p className="sh-display text-3xl font-extrabold text-[#355E3B]">{hover !== null ? `${hrs[hover]} h` : `${total} h`}</p>
            <p className="text-xs text-gray-500">{hover !== null ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][hover] : 'Example week. Hover a bar.'}</p>
            <div className="mt-4 flex h-40 items-end gap-2">
                {hrs.map((h, i) => (
                    <button key={i} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onMouseLeave={() => setHover(null)} aria-label={`${h} hours`}
                        className="sh-grow flex-1 rounded-t-lg transition-colors" style={{ height: `${(h / 4) * 100}%`, background: hover === i ? '#E30B5C' : '#355E3B', animationDelay: `${i * 70}ms` }} />
                ))}
            </div>
            <div className="mt-1 flex gap-2 text-center text-xs text-gray-500">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="flex-1">{d}</span>)}</div>
        </div>
    );
}

const PREVIEWS = { chat: ChatPreview, files: FilesPreview, schedule: SchedulePreview, progress: ProgressPreview };

export default function Welcome({ canLogin, canRegister }) {
    const { auth } = usePage().props;
    const [subject, setSubject] = useState(SUBJECTS[0]);
    const [tab, setTab] = useState('chat');
    const Preview = PREVIEWS[tab];

    return (
        <div className="min-h-screen bg-[#F3F4F6] text-[#1F2937]">
            <Head title="StudyHub-Group Circle System" />
            <ShStyle />

            <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-[#F3F4F6]/85 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
                    <Link href="/" className="sh-display flex items-center gap-2 text-lg font-extrabold text-[#355E3B]">
                        <img src="/images/studyhub-logo.png" alt="" className="h-10 w-10 rounded-full bg-white" /> StudyHub-Group Circle System
                    </Link>
                    <nav className="flex items-center gap-2">
                        {auth?.user ? <Link href={route('dashboard')} className="sh-btn sh-btn-primary !py-2">Open dashboard</Link> : (<>
                            {canLogin && <Link href={route('login')} className="sh-btn sh-btn-ghost !py-2">Log in</Link>}
                            {canRegister && <Link href={route('register')} className="sh-btn sh-btn-accent !py-2">Sign up</Link>}
                        </>)}
                    </nav>
                </div>
            </header>

            <section className="mx-auto grid max-w-6xl items-center gap-8 px-6 pb-16 pt-12 lg:grid-cols-2">
                <div className="sh-fade">
                    <h1 className="sh-display text-5xl font-extrabold leading-[1.05] text-[#1d3321] md:text-6xl">Study is better with a circle.</h1>
                    <p className="mt-5 max-w-lg text-lg text-gray-600">
                        StudyHub puts you in a small group with students who share your subjects, schedule and goals. Chat, call, share notes and track progress in one private place.
                    </p>
                    <p className="mt-8 text-sm font-medium text-gray-700">What are you studying?</p>
                    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Pick a subject">
                        {SUBJECTS.map((s) => <button key={s.n} className="sh-chip" aria-pressed={subject.n === s.n} onClick={() => setSubject(s)}>{s.n}</button>)}
                    </div>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link href={route('register')} className="sh-btn sh-btn-primary">Start your circle <ArrowRight size={16} /></Link>
                        <Link href={route('login')} className="sh-btn sh-btn-ghost">I already have an account</Link>
                    </div>
                </div>
                <div className="relative mx-auto w-full max-w-lg">
                <div className="absolute inset-6 rounded-full bg-[#d6e5d9]/70 blur-2xl" aria-hidden="true" />
                    <img
                    src="/images/study-group.jpg"
                    alt="Four students studying together around open books"
                    draggable="false"
                    className="relative w-full select-none"
                    style={{ mixBlendMode: 'multiply' }}
                    />
                    <div key={subject.n} className="sh-fade absolute bottom-6 left-4 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1d3321] shadow-lg">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                        {subject.n} circle
                    </div>
                </div>
                
            </section>

            <section className="border-y border-gray-200 bg-white/60">
                <div className="mx-auto max-w-6xl px-6 py-16">
                    <h2 className="sh-display text-3xl font-extrabold text-[#1d3321]">Everything your circle needs, in one place</h2>
                    <p className="mt-2 text-gray-600">Pick a feature and try it. These previews are live.</p>
                    <div className="mt-8 grid gap-6 lg:grid-cols-5">
                        <div className="space-y-2 lg:col-span-2" role="tablist" aria-label="Features">
                            {TABS.map(({ id, label, Icon, blurb }) => (
                                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="sh-tab">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: tab === id ? '#E30B5C' : '#355E3B' }}><Icon size={18} /></span>
                                    <span><b className="sh-display block">{label}</b><span className="text-sm text-gray-600">{blurb}</span></span>
                                </button>
                            ))}
                        </div>
                        <div className="lg:col-span-3">
                            <div className="sh-card h-96 overflow-hidden shadow-xl shadow-[#355E3B]/10">
                                <div className="flex items-center gap-2 bg-[#355E3B] px-4 py-2 text-sm font-semibold text-white">
                                    <span className="h-2.5 w-2.5 rounded-full bg-[#E30B5C]" /> Programming Study Group
                                </div>
                                <div key={tab} className="sh-fade h-[calc(100%-2.5rem)] overflow-y-auto"><Preview /></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-6 py-16">
                <h2 className="sh-display text-3xl font-extrabold text-[#1d3321]">Up and running in three steps</h2>
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {[['Find your people', 'Search circles by subject and skill level, or create your own.'], ['Study together', 'Chat, jump on a call, share files and plan sessions.'], ['See your progress', 'Log hours, finish tasks and watch your circle improve.']].map(([t, d], i) => (
                        <div key={t} className="sh-card p-6 transition-transform hover:-translate-y-1">
                            <span className="sh-display flex h-10 w-10 items-center justify-center rounded-full bg-[#355E3B] font-bold text-white">{i + 1}</span>
                            <h3 className="sh-display mt-4 text-xl font-bold">{t}</h3><p className="mt-1 text-sm text-gray-600">{d}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="px-6 pb-16">
                <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 rounded-3xl px-8 py-14 text-center text-white" style={{ background: 'linear-gradient(135deg,#355E3B,#1d3321)' }}>
                    <h2 className="sh-display text-4xl font-extrabold">Your circle is waiting.</h2>
                    <p className="max-w-md text-[#d6e5d9]">Create a free account and join your first study group today.</p>
                    <Link href={route('register')} className="sh-btn sh-btn-accent">Create my account <ArrowRight size={16} /></Link>
                </div>
            </section>

            <footer className="pb-8 text-center text-sm text-gray-500">StudyHub: Group Circle System</footer>
        </div>
    );
}