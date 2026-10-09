import { useEffect, useRef, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Bell, ChevronRight, FileText, Flag, Layers, LayoutDashboard, LogOut, Menu, Search, Settings as Cog, Users, X } from 'lucide-react';

const NAV = [
    ['Dashboard', 'admin.index', 'admin.index', LayoutDashboard],
    ['Users', 'admin.users', 'admin.users*', Users],
    ['Groups', 'admin.groups', 'admin.groups*', Layers],
    ['Reports', 'admin.reports', 'admin.reports*', Flag],
    ['Content', 'admin.content', 'admin.content*', FileText],
    ['Settings', 'admin.settings', 'admin.settings*', Cog],
];

export const seen = (iso) => {
    if (!iso) return 'Never';
    const mins = (Date.now() - new Date(iso).getTime()) / 60000;
    return mins < 5 ? 'Online now' : new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

export function Panel({ title, action, children, className = '' }) {
    return (
        <section className={`rounded-xl border border-gray-200 bg-white ${className}`}>
            {(title || action) && (
                <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                    <h2 className="font-semibold text-[#1F2937]">{title}</h2>{action}
                </header>
            )}
            {children}
        </section>
    );
}

export function Kpi({ label, value, sub, Icon, tone = '#355E3B', href }) {
    const body = (
        <div className="flex items-start justify-between rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
            <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-3xl font-bold text-[#1F2937]">{value}</p>
                <p className="mt-1 text-xs text-gray-500">{sub}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: tone }}><Icon size={18} /></span>
        </div>
    );
    return href ? <Link href={href} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E30B5C]">{body}</Link> : body;
}

const TONES = { green: ['#d6e5d9', '#2a4a2f'], pink: ['#fde7ef', '#C81E51'], gray: ['#E5E7EB', '#374151'], dark: ['#1F2937', '#fff'] };
export const Badge = ({ tone = 'gray', children }) => (
    <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: TONES[tone][0], color: TONES[tone][1] }}>{children}</span>
);

export const Btn = ({ tone = 'ghost', className = '', ...p }) => (
    <button className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tone === 'danger' ? 'bg-[#E30B5C] text-white hover:bg-[#C81E51]' : tone === 'primary' ? 'bg-[#355E3B] text-white hover:bg-[#2a4a2f]' : 'border border-gray-300 bg-white text-[#1F2937] hover:bg-gray-100'} ${className}`} {...p} />
);

export const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#355E3B] focus:outline-none focus:ring-2 focus:ring-[#355E3B]/20';

export function Pager({ links }) {
    if (!links || links.length <= 3) return null;
    return (
        <nav className="flex flex-wrap gap-1 border-t border-gray-100 p-3" aria-label="Pagination">
            {links.map((l, i) => l.url
                ? <Link key={i} href={l.url} preserveScroll className={`rounded-lg px-3 py-1 text-sm ${l.active ? 'bg-[#355E3B] font-semibold text-white' : 'hover:bg-gray-100'}`} dangerouslySetInnerHTML={{ __html: l.label }} />
                : <span key={i} className="px-3 py-1 text-sm text-gray-400" dangerouslySetInnerHTML={{ __html: l.label }} />)}
        </nav>
    );
}

/** Debounced filters that sync to the URL. */
export function useLiveFilters(routeName, initial) {
    const [f, setF] = useState(initial);
    const first = useRef(true);
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        const t = setTimeout(() => router.get(route(routeName), Object.fromEntries(Object.entries(f).filter(([, v]) => v)), { preserveState: true, replace: true }), 300);
        return () => clearTimeout(t);
    }, [f]);
    return [f, (k, v) => setF((s) => ({ ...s, [k]: v }))];
}

export default function AdminLayout({ title, crumbs = [], actions, children }) {
    const { auth, unread, flash, openReports } = usePage().props;
    const [side, setSide] = useState(false);
    const [menu, setMenu] = useState(false);
    const [q, setQ] = useState('');
    const [res, setRes] = useState(null);
    const box = useRef(null);
    const menuBox =useRef(null);

    useEffect(() => {
    const h = (e) => {
        if (box.current && !box.current.contains(e.target)) setRes(null);
        if (menuBox.current && !menuBox.current.contains(e.target)) setMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
    }, []);

    useEffect(() => {
        if (q.trim().length < 2) { setRes(null); return; }
        const ctl = new AbortController();
        const t = setTimeout(() => {
            fetch(route('admin.search', { q }), { headers: { Accept: 'application/json' }, credentials: 'same-origin', signal: ctl.signal })
                .then((r) => r.json()).then(setRes).catch(() => {});
        }, 250);
        return () => { clearTimeout(t); ctl.abort(); };
    }, [q]);

    const go = (name, params) => { setRes(null); setQ(''); router.get(route(name, params)); };

    return (
        <div className="min-h-screen bg-[#F3F4F6] text-[#1F2937]">
            {/* TOPBAR */}
            <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4">
                <button className="rounded-lg p-2 hover:bg-gray-100 lg:hidden" onClick={() => setSide(!side)} aria-label="Toggle menu">{side ? <X size={20} /> : <Menu size={20} />}</button>
                <Link href={route('admin.index')} className="flex items-center gap-2 font-bold text-[#355E3B]">
                    <img src="/images/studyhub-logo.png" alt="" className="h-8 w-8 rounded-full" />
                    <span className="hidden sm:inline">StudyHub</span>
                    <span className="rounded bg-[#1F2937] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Admin</span>
                </Link>

                <div ref={box} className="relative mx-auto w-full max-w-md">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users and groups" aria-label="Search users and groups"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-[#355E3B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#355E3B]/20" />
                    {res && (
                        <div className="absolute left-0 right-0 top-11 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white py-2 shadow-xl">
                            {res.users.length === 0 && res.groups.length === 0 && <p className="px-4 py-2 text-sm text-gray-500">No matches.</p>}
                            {res.users.length > 0 && <p className="px-4 pt-1 text-xs font-semibold text-gray-400">USERS</p>}
                            {res.users.map((u) => <button key={u.id} onClick={() => go('admin.users', { q: u.email })} className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100">{u.name}<span className="ml-2 text-xs text-gray-500">{u.email}</span></button>)}
                            {res.groups.length > 0 && <p className="px-4 pt-2 text-xs font-semibold text-gray-400">GROUPS</p>}
                            {res.groups.map((g) => <button key={g.id} onClick={() => go('admin.groups', { q: g.title })} className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100">{g.title}<span className="ml-2 text-xs text-gray-500">{g.topic}</span></button>)}
                        </div>
                    )}
                </div>

                <Link href={route('notifications.index', { view: 'admin' })} className="relative rounded-lg p-2 hover:bg-gray-1000"> 
                    <Bell size={20} />  
                    {unread > 0 && <span className="absolute right-0.5 top-0.5 rounded-full bg-[#E30B5C] px-1.5 text-[10px] font-bold text-white">{unread}</span>}
                </Link>

                <div className="relative" ref={menuBox}>
                    <button onClick={() => setMenu(!menu)} className="flex items-center gap-2 rounded-lg p-1 hover:bg-gray-100" aria-haspopup="menu" aria-expanded={menu}>
                        <img src={auth.user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        <span className="hidden text-sm font-medium md:block">{auth.user.name}</span>
                    </button>
                    {menu && (
                        <div role="menu" className="absolute right-0 top-11 w-52 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                            
                            <Link href={route('profile.edit')} className="block px-4 py-2 text-sm hover:bg-gray-100">Profile settings</Link>
                            <button onClick={() => router.post(route('logout'))} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-100"><LogOut size={14} /> Log out</button>
                        </div>
                    )}
                </div>
            </header>

            {/* SIDEBAR */}
            <aside className={`fixed bottom-0 left-0 top-14 z-30 w-60 overflow-y-auto bg-[#1F2937] p-3 text-gray-300 transition-transform lg:translate-x-0 ${side ? 'translate-x-0' : '-translate-x-full'}`}>
                <nav className="space-y-1" aria-label="Admin">
                    {NAV.map(([label, name, pattern, Icon]) => {
                        const active = route().current(pattern);
                        return (
                            <Link key={name} href={route(name)} onClick={() => setSide(false)}
                                className={`flex items-center gap-3 rounded-lg border-l-4 px-3 py-2 text-sm transition-colors ${active ? 'border-[#E30B5C] bg-white/10 font-semibold text-white' : 'border-transparent hover:bg-white/5 hover:text-white'}`}>
                                <Icon size={18} /> <span className="flex-1">{label}</span>
                                {name === 'admin.reports' && openReports > 0 && <span className="rounded-full bg-[#E30B5C] px-2 text-xs font-bold text-white">{openReports}</span>}
                            </Link>
                        );
                    })}
                </nav>
            </aside>
            {side && <div className="fixed inset-0 top-14 z-20 bg-black/40 lg:hidden" onClick={() => setSide(false)} />}

            {/* MAIN */}
            <main className="pt-14 lg:pl-60">
                <div className="mx-auto max-w-7xl p-6">
                    <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                        <Link href={route('admin.index')} className="hover:text-[#355E3B]">Admin</Link>
                        {crumbs.map(([label, href]) => (
                            <span key={label} className="flex items-center gap-1"><ChevronRight size={12} />{href ? <Link href={href} className="hover:text-[#355E3B]">{label}</Link> : <span className="text-[#1F2937]">{label}</span>}</span>
                        ))}
                    </nav>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <h1 className="text-2xl font-bold">{title}</h1>{actions}
                    </div>
                    {flash?.success && <div role="status" className="mb-4 rounded-lg bg-[#d6e5d9] px-4 py-2 text-sm text-[#2a4a2f]">{flash.success}</div>}
                    {children}
                </div>
            </main>
        </div>
    );
}
