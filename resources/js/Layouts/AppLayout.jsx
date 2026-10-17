import { useEffect, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { Bell, BookOpen, CalendarDays, CheckSquare, Contact, FolderOpen, LayoutDashboard, LineChart, Menu, MessageSquare, Search, Shield, Users, X } from 'lucide-react';
import CallOverlay from '@/Components/CallOverlay';
import { init as initCalls } from '@/lib/callManager';
import { setEcho, startHeartbeat } from '@/lib/presence';

const NAV = [
  ['Dashboard', 'dashboard', LayoutDashboard], ['Find Groups', 'groups.find', Search], ['My Groups', 'groups.index', Users], ['Members', 'members.index', Contact],
  ['Messages', 'messages.index', MessageSquare], ['Notes & Files', 'files.index', FolderOpen], ['Schedule', 'schedule.index', CalendarDays],
  ['Tasks', 'tasks.index', CheckSquare], ['Progress', 'progress.index', LineChart]
];

// >>> CHANGE THIS ONE WORD to switch the menu: 'top' = bar on top, 'side' = sidebar on the left <<<
const NAV_POSITION = 'side';

export default function AppLayout({ title, children }) {
  const { auth, unread, flash, announcement, recent = [] } = usePage().props;
  const [panel, setPanel] = useState(null);  // which header dropdown is open: 'bell' | 'profile' | null
  const [open, setOpen] = useState(false);   // phone menu (hamburger)

  // Close the phone menu and profile dropdown whenever we move to another page.
  useEffect(() => router.on('navigate', () => { setOpen(false); setPanel(null); }), []);

  // Click anywhere outside a header dropdown (or press Esc) to close it.
  useEffect(() => {
    const away = (e) => { if (!e.target.closest('[data-dd]')) setPanel(null); };
    const esc = (e) => { if (e.key === 'Escape') setPanel(null); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, []);

  // Tell the server we're here (every 30s) so the Members page and call buttons know who is active,
  // and get ready to place or receive calls on any page.
  useEffect(() => { initCalls(auth.user); return startHeartbeat(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // Optional instant presence through Laravel Echo (only if Echo/Reverb is set up). The heartbeat above works without it.
  useEffect(() => {
    if (!window.Echo) return;
    const online = new Set();
    const push = () => setEcho(online);
    window.Echo.join('online')
      .here((u) => { u.forEach((x) => online.add(x.id)); push(); })
      .joining((u) => { online.add(u.id); push(); })
      .leaving((u) => { online.delete(u.id); push(); });
    return () => window.Echo.leave('online');
  }, []);

  const items = auth.user.role === 'admin' ? [...NAV, ['Admin', 'admin.index', Shield]] : NAV;

  // Highlight exactly one menu item. An exact route match wins (groups.find vs groups.index);
  // otherwise fall back to the section's index page (e.g. groups.show -> My Groups).
  const cur = route().current() ?? '';
  const names = items.map((i) => i[1]);
  const sectionMatches = names.filter((n) => cur.startsWith(n.split('.')[0] + '.'));
  const activeName = names.includes(cur) ? cur : (sectionMatches.find((n) => n.endsWith('.index')) ?? sectionMatches[0]);

  const isTop = NAV_POSITION !== 'side';

  // variant 'bar' = horizontal links in the top bar (laptop), 'stack' = vertical list (phone menu / sidebar)
  const links = (variant) => items.filter(([, name]) => variant !== 'bar' || name !== 'notifications.index').map(([label, name, Icon]) => {
    const active = name === activeName;
    const base = variant === 'bar'
      ? 'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-[13px] 2xl:gap-2 2xl:px-3 2xl:text-sm'
      : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm';
    return (
      <Link key={name} href={route(name)} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)}
        className={`${base} ${active ? 'bg-raspberry-600 font-semibold' : 'text-hunter-100 hover:bg-hunter-800'}`}>
        <Icon size={variant === 'bar' ? 16 : 18} /> {label}
      </Link>
    );
  });

  const userArea = (dark) => (
    <div className="relative flex shrink-0 items-center gap-4" data-dd>
      {/* Notifications bell with a dropdown of the latest items */}
      <button onClick={() => setPanel(panel === 'bell' ? null : 'bell')} className={`relative ${dark ? 'text-white' : 'text-slate-900'}`}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`} aria-haspopup="menu" aria-expanded={panel === 'bell'}>
        <Bell size={20} />
        {unread > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-raspberry-500 px-1.5 text-xs font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {panel === 'bell' && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-gray-200 bg-white text-slate-900 shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <b className="text-sm">Notifications</b>
            {unread > 0 && <button onClick={() => router.post(route('notifications.read'), {}, { preserveScroll: true })} className="text-xs text-hunter-700 underline">Mark all as read</button>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {recent.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet.</p>}
            {recent.map((n) => {
              const cls = `block border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-cool-100 ${n.read ? '' : 'bg-hunter-50'}`;
              const body = (<><p className={`text-sm ${n.read ? '' : 'font-semibold'}`}>{n.message}</p><p className="text-xs text-gray-400">{n.ago}</p></>);
              return n.url ? <Link key={n.id} href={n.url} className={cls}>{body}</Link> : <div key={n.id} className={cls}>{body}</div>;
            })}
          </div>
          <Link href={route('notifications.index')} className="block border-t border-gray-100 px-4 py-2 text-center text-sm font-medium text-hunter-700 hover:bg-cool-100">View all notifications</Link>
        </div>
      )}

      {/* Profile photo with its own dropdown */}
      <button onClick={() => setPanel(panel === 'profile' ? null : 'profile')} className="flex items-center gap-2" aria-haspopup="menu" aria-expanded={panel === 'profile'} aria-label="Profile menu">
        <img src={auth.user.avatar_url} alt="" className={`h-8 w-8 rounded-full object-cover ${dark ? 'ring-2 ring-white/80' : ''}`} />
        <span className={`hidden text-sm font-medium ${isTop ? '2xl:block' : 'lg:block'}`}>{auth.user.name}</span>
      </button>
      {panel === 'profile' && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-44 rounded-lg border border-gray-200 bg-white py-1 text-slate-900 shadow-lg">
          <Link href={route('profile.edit')} className="block px-4 py-2 text-sm hover:bg-cool-100">Profile settings</Link>
          <button onClick={() => router.post(route('logout'))} className="block w-full px-4 py-2 text-left text-sm hover:bg-cool-100">Log out</button>
        </div>
      )}
    </div>
  );

  const logo = (
    <Link href={route('dashboard')} className="flex shrink-0 items-center gap-2 text-lg font-bold">
      <img src="/images/studyhub-logo.png" alt="" className="h-9 w-9 rounded-full bg-white" />
      <span className={isTop ? 'hidden sm:inline' : ''}>StudyHub</span>
    </Link>
  );

  const hamburger = (
    <button onClick={() => setOpen(!open)} className={`rounded-lg p-2 text-white hover:bg-hunter-800 ${isTop ? 'xl:hidden' : 'md:hidden'}`}
      aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
      {open ? <X size={22} /> : <Menu size={22} />}
    </button>
  );

  const titleStrip = (
    <div className="border-b border-gray-200 bg-white px-4 py-3 md:px-6"><h1 className="truncate text-lg font-semibold md:text-xl">{title}</h1></div>
  );
  const flashBar = flash?.success && <div className="bg-hunter-100 px-4 py-2 text-sm text-hunter-800 md:px-6">{flash.success}</div>;
  {announcement && <div role="status" className="bg-[#E30B5C] px-6 py-2 text-sm text-white">{announcement}</div>}


  if (isTop) {
    return (
      <div className="flex min-h-screen flex-col bg-cool-100 text-slate-900">
        <header className="sticky top-0 z-30 bg-hunter-700 text-white shadow-sm">
          <div className="flex items-center gap-3 px-4 py-2">
            {logo}
            {/* laptop: links in the bar. phone: hidden, opened with the hamburger */}
            <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-2 xl:flex" aria-label="Main menu">{links('bar')}</nav>
            <div className="ml-auto flex items-center gap-2 xl:ml-0">{userArea(true)}{hamburger}</div>
          </div>
          {open && <nav className="space-y-1 border-t border-hunter-800 px-3 py-3 xl:hidden" aria-label="Main menu">{links('stack')}</nav>}
        </header>
        {titleStrip}{flashBar}
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
        <CallOverlay />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-cool-100 text-slate-900">
      {/* laptop: fixed sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-hunter-700 text-white md:flex">
        <div className="px-5 py-5">{logo}</div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Main menu">{links('stack')}</nav>
        <Link href={route('profile.edit')} className="m-3 rounded-lg px-3 py-2 text-sm text-hunter-100 hover:bg-hunter-800">Profile</Link>
      </aside>

      {/* phone: slide-in drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto bg-hunter-700 p-3 text-white">
            <div className="mb-3 flex items-center justify-between px-2 py-2">{logo}
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-hunter-800" aria-label="Close menu"><X size={22} /></button>
            </div>
            <nav className="flex-1 space-y-1" aria-label="Main menu">{links('stack')}</nav>
            <Link href={route('profile.edit')} onClick={() => setOpen(false)} className="mt-3 rounded-lg px-3 py-2 text-sm text-hunter-100 hover:bg-hunter-800">Profile</Link>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* phone top bar with the hamburger */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-hunter-700 px-4 py-2 text-white md:hidden">
          <div className="flex items-center gap-2">{hamburger}{logo}</div>
          {userArea(true)}
        </header>
        {/* laptop header with title + profile */}
        <header className="hidden items-center justify-between border-b border-gray-200 bg-white px-6 py-3 md:flex">
          <h1 className="text-xl font-semibold">{title}</h1>
          {userArea(false)}
        </header>
        <div className="md:hidden">{titleStrip}</div>
        {flashBar}
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
      <CallOverlay />
    </div>
  );
}

export const Card = ({ className = '', ...p }) => <section className={`rounded-xl border border-gray-200 bg-white p-5 ${className}`} {...p} />;
export const Btn = ({ variant = 'primary', className = '', ...p }) => (
  <button className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${variant === 'primary' ? 'bg-hunter-700 text-white hover:bg-hunter-800' : variant === 'accent' ? 'bg-raspberry-600 text-white hover:bg-raspberry-500' : 'border border-gray-300 hover:bg-cool-100'} ${className}`} {...p} />
);
export const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-hunter-700 focus:ring-hunter-700';
