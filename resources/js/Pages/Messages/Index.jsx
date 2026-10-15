import { Head, Link } from '@inertiajs/react';
import AppLayout, { Card } from '@/Layouts/AppLayout';
import ChatPanel from '@/Components/ChatPanel';
import CallPanel from '@/Components/CallPanel';
import OnlineDot from '@/Components/OnlineDot';
import SharedReader from '@/Components/SharedReader';
import { ActiveBadge, GroupCover } from '@/Components/GroupBits';

export default function Messages({ contacts = [], peer = null, messages = [], groups = [], group = null, groupMembers = [], auth }) {
    const me = auth.user.id;
    const channel = peer ? `dm.${Math.min(me, peer.id)}.${Math.max(me, peer.id)}` : null;

    return (
        <AppLayout title="Messages">
            <Head title="Messages" />
            <div className="grid gap-4 lg:grid-cols-4">
                {/* ---------- left: every study group (with its picture) + direct messages ---------- */}
                <div className="space-y-4 lg:col-span-1">
                    <Card>
                        <h2 className="mb-3 font-semibold">Study groups</h2>
                        {groups.length === 0 && <p className="text-sm text-gray-500">Join a circle to see its chat here.</p>}
                        <div className="space-y-3">
                            {groups.map((g) => (
                                <Link key={g.id} href={route('messages.index', { group: g.id })} aria-current={group?.id === g.id ? 'true' : undefined}
                                    className={`block overflow-hidden rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg ${group?.id === g.id ? 'ring-2 ring-[#FBB02D] ring-offset-2 ring-offset-[#EBF2FA]' : ''}`}>
                                    <GroupCover group={g} className="h-24">
                                        <div className="absolute right-2 top-2"><ActiveBadge groupId={g.id} onCover /></div>
                                        <div className="absolute inset-x-0 bottom-0 p-2.5 text-white"><b className="block truncate text-sm">{g.title}</b><span className="block truncate text-xs text-white/80">{g.members_count} members · {g.topic}</span></div>
                                    </GroupCover>
                                </Link>
                            ))}
                        </div>
                    </Card>

                    <Card>
                        <h2 className="mb-2 font-semibold">Students in your circles</h2>
                        {contacts.length === 0 && <p className="text-sm text-gray-500">Join a circle to start chatting.</p>}
                        {contacts.map((c) => (
                            <Link key={c.id} href={route('messages.index', { user_id: c.id })}
                                className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${peer?.id === c.id ? 'bg-[#038666]/15' : 'hover:bg-black/5'}`}>
                                <img src={c.avatar_url} className="h-7 w-7 rounded-full" alt="" />
                                <span className="min-w-0 flex-1"><span className="block truncate">{c.name}</span>
                                    {c.last_message && <span className="block truncate text-xs text-gray-500">{c.last_message}</span>}</span>
                                <OnlineDot userId={c.id} />
                            </Link>
                        ))}
                    </Card>
                </div>

                {/* ---------- right: the open conversation ---------- */}
                <div className="space-y-3 lg:col-span-3">
                    {group ? (<>
                        <GroupCover group={group} className="h-24 rounded-2xl">
                            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
                                <div className="min-w-0"><h2 className="truncate text-lg font-bold">{group.title}</h2><p className="truncate text-sm text-white/80">{group.topic} · {group.members_count} members</p></div>
                                <ActiveBadge groupId={group.id} onCover />
                            </div>
                        </GroupCover>
                        <div className="grid gap-4 xl:grid-cols-5">
                            <div className="xl:col-span-3">
                                <ChatPanel threaded messages={messages} channel={`group.${group.id}`} postUrl={route('messages.group', group.id)} />
                            </div>
                            <div className="space-y-4 xl:col-span-2">
                                <CallPanel targets={groupMembers.filter((m) => m.id !== me).map((m) => m.id)} people={groupMembers} />
                                <SharedReader groupId={group.id} />
                            </div>
                        </div>
                    </>) : peer ? (<>
                        <CallPanel targets={[peer.id]} people={[peer]} />
                        <ChatPanel messages={messages} channel={channel} postUrl={route('messages.direct', peer.id)} />
                    </>) : <p className="text-sm text-gray-500">Pick a study group or a student to start a conversation.</p>}
                </div>
            </div>
        </AppLayout>
    );
}
