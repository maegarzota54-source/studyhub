import { useEffect, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { Bell, BookOpen, CalendarDays, CheckSquare, FolderOpen, LayoutDashboard, LineChart, MessageSquare, Search, Shield, Users } from 'lucide-react';

const NAV = [
  ['Dashboard', 'dashboard', LayoutDashboard], ['Find Groups', 'groups.find', Search], ['My Groups', 'groups.index', Users],
  ['Messages', 'messages.index', MessageSquare], ['Notes & Files', 'files.index', FolderOpen], ['Schedule', 'schedule.index', CalendarDays],
  ['Tasks', 'tasks.index', CheckSquare], ['Progress', 'progress.index', LineChart], ['Notifications', 'notifications.index', Bell],
];

export default function AppLayout({ title, children }) {
  const { auth, unread, flash } = usePage().props;
  const [menu, setMenu] = useState(false);

  // Join the presence channel so other pages can show who is online.
  useEffect(() => {
    if (!window.Echo) return;
    window.__online = new Set();
    const ch = window.Echo.join('online')
      .here((u) => { window.__online = new Set(u.map((x) => x.id)); window.dispatchEvent(new Event('presence')); })
      .joining((u) => { window.__online.add(u.id); window.dispatchEvent(new Event('presence')); })
      .leaving((u) => { window.__online.delete(u.id); window.dispatchEvent(new Event('presence')); });
    return () => window.Echo.leave('online');
  }, []);

  const items = auth.user.role === 'admin' ? [...NAV, ['Admin', 'admin.index', Shield]] : NAV;

  return (
    <div className="flex min-h-screen bg-cool-100 text-slate-900">
      <aside className="hidden w-60 shrink-0 flex-col bg-hunter-700 text-white md:flex">
        <Link href={route('dashboard')} className="flex items-center gap-2 px-5 py-5 text-lg font-bold">
          <img src="/images/studyhub-logo.png" alt="" className="h-9 w-9 rounded-full bg-white" /> StudyHub
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {items.map(([label, name, Icon]) => {
            const active = route().current(name.split('.')[0] + '*');
            return (
              <Link key={name} href={route(name)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${active ? 'bg-raspberry-600 font-semibold' : 'text-hunter-100 hover:bg-hunter-800'}`}>
                <Icon size={18} /> {label}
              </Link>
            );
          })}
        </nav>
        <Link href={route('profile.edit')} className="m-3 rounded-lg px-3 py-2 text-sm text-hunter-100 hover:bg-hunter-800">Profile</Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <h1 className="text-xl font-semibold">{title}</h1>
          <div className="relative flex items-center gap-4">
            <Link href={route('notifications.index')} className="relative text-slate-900" aria-label="Notifications">
              <Bell size={20} />
              {unread > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-raspberry-500 px-1.5 text-xs font-bold text-white">{unread}</span>}
            </Link>
            <button onClick={() => setMenu(!menu)} className="flex items-center gap-2" aria-haspopup="menu" aria-expanded={menu}>
              <img src={auth.user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              <span className="hidden text-sm font-medium sm:block">{auth.user.name}</span>
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 top-11 z-20 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <Link href={route('profile.edit')} className="block px-4 py-2 text-sm hover:bg-cool-100">Profile settings</Link>
                <button onClick={() => router.post(route('logout'))} className="block w-full px-4 py-2 text-left text-sm hover:bg-cool-100">Log out</button>
              </div>
            )}
          </div>
        </header>
        {flash?.success && <div className="bg-hunter-100 px-6 py-2 text-sm text-hunter-800">{flash.success}</div>}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export const Card = ({ className = '', ...p }) => <section className={`rounded-xl border border-gray-200 bg-white p-5 ${className}`} {...p} />;
export const Btn = ({ variant = 'primary', className = '', ...p }) => (
  <button className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${variant === 'primary' ? 'bg-hunter-700 text-white hover:bg-hunter-800' : variant === 'accent' ? 'bg-raspberry-600 text-white hover:bg-raspberry-500' : 'border border-gray-300 hover:bg-cool-100'} ${className}`} {...p} />
);
export const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-hunter-700 focus:ring-hunter-700';
