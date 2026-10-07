import { Head, Link } from '@inertiajs/react';
import AppLayout, { Card } from '@/Layouts/AppLayout';
import ChatPanel from '@/Components/ChatPanel';
import CallPanel from '@/Components/CallPanel';
import OnlineDot from '@/Components/OnlineDot';

export default function Messages({ contacts, peer, messages, auth }) {
  const me = auth.user.id;
  const channel = peer ? `dm.${Math.min(me, peer.id)}.${Math.max(me, peer.id)}` : null;
  return (
    <AppLayout title="Messages">
      <Head title="Messages" />
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <h2 className="mb-2 font-semibold">Students in your circles</h2>
          {contacts.length === 0 && <p className="text-sm text-gray-500">Join a circle to start chatting.</p>}
          {contacts.map((c) => (
            <Link key={c.id} href={route('messages.index', { user_id: c.id })}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${peer?.id === c.id ? 'bg-hunter-50' : 'hover:bg-cool-100'}`}>
              <img src={c.avatar_url} className="h-7 w-7 rounded-full" alt="" /> <span className="min-w-0 flex-1"><span className="block truncate">{c.name}</span>
                {c.last_message && <span className="block truncate text-xs text-gray-500">{c.last_message}</span>}</span> <OnlineDot userId={c.id} />
            </Link>
          ))}
        </Card>
        <div className="space-y-3 lg:col-span-3">
          {peer ? (<>
            <CallPanel targets={[peer.id]} people={[peer]} />
            <ChatPanel messages={messages} channel={channel} postUrl={route('messages.direct', peer.id)} />
          </>) : <p className="text-sm text-gray-500">Pick someone to start a conversation.</p>}
        </div>
      </div>
    </AppLayout>
  );
}
