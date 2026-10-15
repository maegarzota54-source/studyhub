import { useEffect, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowRight, Bell, CalendarDays, CheckCircle2, CheckSquare, Circle, Clock, FolderOpen, Flame,
    LineChart, MessageSquare, Pause, Play, Plus, Search, Square, Users,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';

const G = '#355E3B', R = '#E30B5C', DARK = '#1F2937';

const Card = ({ className = '', children }) => <section className={`rounded-2xl border border-gray-200 bg-white ${className}`}>{children}</section>;
const Head2 = ({ Icon, title, action }) => (
    <header className="flex items-center justify-between px-5 pt-5">
        <h2 className="flex items-center gap-2 font-semibold text-[#1F2937]"><Icon size={18} color={G} aria-hidden="true" /> {title}</h2>{action}
    </header>
);
const More = ({ href, children }) => <Link href={href} className="flex items-center gap-1 text-sm font-medium text-[#355E3B] hover:underline">{children}<ArrowRight size={14} /></Link>;

/* ---------- hero ring ---------- */
function GoalRing({ hours, goal, ready }) {
    const pct = Math.min(1, hours / goal), r = 46, c = 2 * Math.PI * r;
    return (
        <div className="relative h-32 w-32 shrink-0" role="img" aria-label={`${hours} of ${goal} study hours this week`}>
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="10" />
                <circle cx="60" cy="60" r={r} fill="none" stroke={pct >= 1 ? '#86efac' : '#fff'} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={ready ? c * (1 - pct) : c} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold leading-none">{hours}</span>
                <span className="text-[11px] text-white/80">of {goal} h goal</span>
            </div>
        </div>
    );
}

/* ---------- focus timer ---------- */
function FocusTimer({ groups }) {
    const [secs, setSecs] = useState(0), [running, setRunning] = useState(false);
    const [circle, setCircle] = useState(''), [topic, setTopic] = useState(''), [note, setNote] = useState('');

    useEffect(() => {
        if (!running) return;
        const id = setInterval(() => setSecs((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, [running]);

    const log = (minutes, after) => router.post(route('progress.store'),
        { minutes, topic: topic || null, study_group_id: circle || null },
        { preserveScroll: true, onSuccess: () => { setNote(`Logged ${minutes} min. Nice work!`); after?.(); } });

    const stop = () => {
        setRunning(false);
        if (secs < 30) { setNote('Study for at least 30 seconds to log a session.'); setSecs(0); return; }
        log(Math.max(1, Math.round(secs / 60)), () => setSecs(0));
    };
    const t = [Math.floor(secs / 3600), Math.floor(secs / 60) % 60, secs % 60].map((n) => String(n).padStart(2, '0')).join(':');

    return (
        <section className="rounded-2xl p-5 text-white" style={{ background: DARK }}>
            <h2 className="flex items-center gap-2 font-semibold"><Clock size={18} aria-hidden="true" /> Focus timer</h2>
            <p className="mt-4 text-center font-mono text-5xl font-bold tabular-nums" aria-live="off">{t}</p>
            <div className="mt-4 grid gap-2">
                <select value={circle} onChange={(e) => setCircle(e.target.value)} aria-label="Study circle" className="rounded-lg border-0 bg-white/10 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-[#E30B5C]">
                    <option value="" className="text-black">Personal study</option>
                    {groups.map((g) => <option key={g.id} value={g.id} className="text-black">{g.title}</option>)}
                </select>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What are you studying?" aria-label="Topic" className="rounded-lg border-0 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-[#E30B5C]" />
            </div>
            <div className="mt-4 flex gap-2">
                <button onClick={() => setRunning(!running)} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 font-semibold transition-transform active:scale-95" style={{ background: running ? '#4B5563' : R }}>
                    {running ? <><Pause size={16} /> Pause</> : <><Play size={16} /> {secs ? 'Resume' : 'Start'}</>}
                </button>
                <button onClick={stop} disabled={!secs} className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 font-semibold transition-colors hover:bg-white/25 disabled:opacity-40"><Square size={14} /> Log</button>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-white/70">
                <span>Quick log:</span>
                {[15, 30, 60].map((m) => <button key={m} onClick={() => log(m)} className="rounded-full bg-white/10 px-3 py-1 font-medium text-white transition-colors hover:bg-white/25">{m} min</button>)}
            </div>
            {note && <p role="status" className="mt-3 text-sm text-green-300">{note}</p>}
        </section>
    );
}

/* ---------- page ---------- */
export default function Dashboard({ stats, weeklyGoal, streak, chart, groups, sessions, tasks, notifications }) {
    const user = usePage().props.auth.user;
    const [ready, setReady] = useState(false);
    const [hover, setHover] = useState(null);
    const [done, setDone] = useState({});

    useEffect(() => { const t = setTimeout(() => setReady(true), 80); return () => clearTimeout(t); }, []);

    const hour = new Date().getHours();
    const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const first = user.name.split(' ')[0];
    const max = Math.max(weeklyGoal / 7, ...chart.map((c) => c.hours), 1);
    const total = chart.reduce((a, c) => a + c.hours, 0).toFixed(1);
    const dailyGoalPct = (weeklyGoal / 7 / max) * 100;

    const complete = (id) => { setDone((d) => ({ ...d, [id]: true })); router.patch(route('tasks.update', id), { status: 'completed' }, { preserveScroll: true }); };
    const due = (d) => {
        if (!d) return null;
        const diff = Math.ceil((new Date(d + 'T23:59:59') - new Date()) / 86400000);
        return diff < 0 ? ['Overdue', R] : diff === 0 ? ['Due today', '#B45309'] : diff === 1 ? ['Tomorrow', G] : [new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' }), '#6B7280'];
    };

    const actions = [['Find a circle', 'groups.find', Search], ['New circle', 'groups.index', Plus], ['Messages', 'messages.index', MessageSquare], ['Add task', 'tasks.index', CheckSquare], ['Schedule', 'schedule.index', CalendarDays], ['Notes & files', 'files.index', FolderOpen]];
    const kpis = [['My circles', stats.groups, Users, G, 'groups.index'], ['Upcoming sessions', stats.upcoming, CalendarDays, '#4a7c52', 'schedule.index'], ['Tasks due', stats.tasks_due, CheckSquare, R, 'tasks.index'], ['Hours this week', stats.hours_week, Clock, DARK, 'progress.index']];

    return (
        <AppLayout title="Dashboard">
            <Head title="Dashboard" />

            {/* HERO */}
            <section className="relative overflow-hidden rounded-2xl p-6 text-white md:p-8" style={{ background: 'linear-gradient(135deg,#355E3B 0%,#2a4a2f 55%,#1d3321 100%)' }}>
                <span className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
                <span className="pointer-events-none absolute -bottom-20 right-40 h-48 w-48 rounded-full" style={{ background: 'rgba(227,11,92,.18)' }} />
                <div className="relative flex flex-wrap items-center justify-between gap-6">
                    <div className="min-w-0 max-w-xl">
                        <p className="text-sm text-white/80">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                        <h1 className="mt-1 text-3xl font-bold md:text-4xl">{hello}, {first}!</h1>
                        <p className="mt-2 text-white/85">{stats.tasks_due > 0 ? `You have ${stats.tasks_due} task${stats.tasks_due > 1 ? 's' : ''} waiting. Let's make today count.` : 'Your task list is clear. Great time to study with your circle.'}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            {actions.map(([label, name, Icon]) => (
                                <Link key={name} href={route(name)} className="flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-2 text-sm font-medium backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white hover:text-[#355E3B]" style={{ background: 'rgba(255,255,255,.14)' }}>
                                    <Icon size={15} aria-hidden="true" /> {label}
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <div className="flex flex-col items-center rounded-2xl px-5 py-4 text-center" style={{ background: 'rgba(255,255,255,.12)' }}>
                            <Flame size={28} color={streak > 0 ? '#fdba74' : '#d1d5db'} aria-hidden="true" />
                            <span className="mt-1 text-2xl font-bold leading-none">{streak}</span>
                            <span className="text-[11px] text-white/80">day streak</span>
                        </div>
                        <GoalRing hours={stats.hours_week} goal={weeklyGoal} ready={ready} />
                    </div>
                </div>
            </section>

            {/* KPI CARDS */}
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {kpis.map(([label, value, Icon, color, name]) => (
                    <Link key={label} href={route(name)} className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-[#355E3B]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E30B5C]">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white transition-transform group-hover:scale-110" style={{ background: color }}><Icon size={22} aria-hidden="true" /></span>
                        <span><span className="block text-2xl font-bold leading-none text-[#1F2937]">{value}</span><span className="text-sm text-gray-500">{label}</span></span>
                    </Link>
                ))}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
                {/* LEFT */}
                <div className="space-y-6 lg:col-span-2">
                    <Card>
                        <Head2 Icon={LineChart} title="This week's study time" action={<More href={route('progress.index')}>Details</More>} />
                        <div className="p-5">
                            <p className="text-3xl font-bold text-[#355E3B]">{hover !== null ? `${chart[hover].hours} h` : `${total} h`}</p>
                            <p className="text-sm text-gray-500">{hover !== null ? chart[hover].date : 'Last 7 days · dashed line = daily goal'}</p>
                            <div className="relative mt-4 flex h-44 items-end gap-3">
                                <span className="pointer-events-none absolute left-0 right-0 border-t border-dashed" style={{ bottom: `${dailyGoalPct}%`, borderColor: R }} aria-hidden="true" />
                                {chart.map((c, i) => (
                                    <button key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                                        aria-label={`${c.date}: ${c.hours} hours`} className="flex h-full flex-1 items-end focus:outline-none">
                                        <span className="block w-full rounded-t-lg transition-all duration-700 ease-out"
                                            style={{ height: ready ? `${Math.max((c.hours / max) * 100, c.hours ? 4 : 2)}%` : '0%', background: hover === i ? R : c.today ? '#4a7c52' : G, opacity: c.hours ? 1 : 0.2, transitionDelay: `${i * 60}ms` }} />
                                    </button>
                                ))}
                            </div>
                            <div className="mt-1 flex gap-3 text-center text-xs text-gray-500">{chart.map((c, i) => <span key={i} className={`flex-1 ${c.today ? 'font-bold text-[#1F2937]' : ''}`}>{c.day}</span>)}</div>
                        </div>
                    </Card>

                    <Card>
                        <Head2 Icon={Users} title="My study circles" action={<More href={route('groups.index')}>All circles</More>} />
                        <div className="grid gap-3 p-5 sm:grid-cols-2">
                            {groups.map((g, i) => (
                                <Link key={g.id} href={route('groups.show', g.id)} className="group flex items-center gap-3 rounded-xl border border-gray-200 p-3 transition-all hover:border-[#355E3B] hover:shadow-md">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ background: [G, R, DARK, '#4a7c52'][i % 4] }}>{g.title[0].toUpperCase()}</span>
                                    <span className="min-w-0 flex-1"><b className="block truncate text-sm">{g.title}</b><span className="block truncate text-xs text-gray-500">{g.topic} · {g.members_count} member{g.members_count !== 1 && 's'}</span></span>
                                    <ArrowRight size={16} className="text-gray-300 transition-all group-hover:translate-x-1 group-hover:text-[#355E3B]" />
                                </Link>
                            ))}
                            <Link href={route('groups.find')} className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-3 text-sm font-medium text-gray-500 transition-colors hover:border-[#E30B5C] hover:text-[#E30B5C]">
                                <Search size={16} /> {groups.length ? 'Find another circle' : 'Find your first circle'}
                            </Link>
                        </div>
                    </Card>

                    <Card>
                        <Head2 Icon={CheckSquare} title="My tasks" action={<More href={route('tasks.index')}>All tasks</More>} />
                        <ul className="p-3">
                            {tasks.length === 0 && <li className="flex flex-col items-center gap-1 px-4 py-8 text-center text-sm text-gray-500"><CheckCircle2 size={28} color={G} />All caught up. {stats.tasks_done_week > 0 && `${stats.tasks_done_week} done this week!`}</li>}
                            {tasks.map((t) => {
                                const d = due(t.due_date), isDone = done[t.id];
                                return (
                                    <li key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-gray-50">
                                        <button onClick={() => complete(t.id)} aria-label={`Mark "${t.title}" complete`} className="shrink-0 text-gray-300 transition-colors hover:text-[#355E3B]">
                                            {isDone ? <CheckCircle2 size={22} color={G} /> : <Circle size={22} />}
                                        </button>
                                        <span className="min-w-0 flex-1"><span className={`block truncate text-sm font-medium ${isDone ? 'text-gray-400 line-through' : ''}`}>{t.title}</span>
                                            <span className="text-xs text-gray-500">{t.group?.title ?? 'Personal'}</span></span>
                                        {d && <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: d[1], background: `${d[1]}1a` }}>{d[0]}</span>}
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>
                </div>

                {/* RIGHT */}
                <div className="space-y-6">
                    <FocusTimer groups={groups} />

                    <Card>
                        <Head2 Icon={CalendarDays} title="Upcoming sessions" action={<More href={route('schedule.index')}>Calendar</More>} />
                        <ul className="space-y-1 p-3">
                            {sessions.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-500">Nothing scheduled. <Link href={route('schedule.index')} className="font-medium text-[#E30B5C] underline">Plan a session</Link></li>}
                            {sessions.map((s) => {
                                const d = new Date(s.starts_at);
                                return (
                                    <li key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-gray-50">
                                        <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[#eef4ef] text-[#355E3B]"><span className="text-[10px] font-semibold uppercase leading-none">{d.toLocaleString([], { month: 'short' })}</span><span className="text-lg font-bold leading-tight">{d.getDate()}</span></span>
                                        <span className="min-w-0 flex-1"><b className="block truncate text-sm">{s.title}</b><span className="block truncate text-xs text-gray-500">{d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{s.group && ` · ${s.group.title}`}</span></span>
                                        {s.group && <Link href={route('groups.show', s.study_group_id)} aria-label={`Open ${s.group.title}`} className="rounded-lg p-2 text-[#355E3B] hover:bg-[#eef4ef]"><ArrowRight size={16} /></Link>}
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>

                    <Card>
                        <Head2 Icon={Bell} title="Notifications" action={notifications.some((n) => !n.read) && <button onClick={() => router.post(route('notifications.read'), {}, { preserveScroll: true })} className="text-sm font-medium text-[#355E3B] hover:underline">Mark all read</button>} />
                        <ul className="p-3">
                            {notifications.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-500">You're all caught up.</li>}
                            {notifications.map((n) => (
                                <li key={n.id}>
                                    <Link href={n.url || route('notifications.index')} className="flex gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-gray-50">
                                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: n.read ? '#D1D5DB' : R }} />
                                        <span className="text-sm"><span className={n.read ? 'text-gray-600' : 'font-medium'}>{n.message}</span><span className="block text-xs text-gray-400">{n.ago}</span></span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}