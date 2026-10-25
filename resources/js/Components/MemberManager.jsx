import { router, useForm } from '@inertiajs/react';
import { Crown, Shield, UserMinus, UserPlus } from 'lucide-react';
import { Btn, Card, inputCls } from '@/Layouts/AppLayout';

/** Member list with roles. Circle admins can invite by email, promote/demote and remove members. */
export default function MemberManager({ group, members, isGroupAdmin, me }) {
    const inv = useForm({ email: '' });
    const invite = (e) => { e.preventDefault(); inv.post(route('groups.invite', group.id), { preserveScroll: true, onSuccess: () => inv.reset() }); };
    const setRole = (m, role) => router.patch(route('groups.members.role', [group.id, m.id]), { role }, { preserveScroll: true });
    const remove = (m) => window.confirm(`Remove ${m.name} from this circle?`) && router.delete(route('groups.members.remove', [group.id, m.id]), { preserveScroll: true });
    const leave = () => window.confirm('Leave this circle?') && router.delete(route('groups.leave', group.id));

    return (
        <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
                <h3 className="mb-3 text-sm font-semibold">Members ({members.length}/{group.max_members})</h3>
                <ul className="divide-y divide-gray-100">
                    {members.map((m) => {
                        const owner = m.id === group.owner_id;
                        const admin = m.circle_role === 'admin';
                        return (
                            <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                                <img src={m.avatar_url} alt="" className="h-9 w-9 rounded-full" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">{m.name}{m.id === me.id && ' (you)'}</p>
                                    <p className="flex items-center gap-1 text-xs text-gray-500">
                                        {owner ? <><Crown size={12} aria-hidden="true" /> Owner</> : admin ? <><Shield size={12} aria-hidden="true" /> Circle admin</> : 'Member'}
                                    </p>
                                </div>
                                {isGroupAdmin && !owner && (
                                    <div className="flex gap-1.5">
                                        <button type="button" onClick={() => setRole(m, admin ? 'member' : 'admin')} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0B8A94]">{admin ? 'Make member' : 'Make admin'}</button>
                                        <button type="button" onClick={() => remove(m)} aria-label={`Remove ${m.name}`} className="inline-flex items-center gap-1 rounded-lg border border-[#C81E51]/40 px-2.5 py-1 text-xs font-semibold text-[#C81E51] hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C81E51]"><UserMinus size={12} aria-hidden="true" /> Remove</button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
                {group.owner_id !== me.id && <button type="button" onClick={leave} className="mt-4 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold hover:bg-black/5">Leave circle</button>}
            </Card>
            {isGroupAdmin && (
                <Card>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><UserPlus size={16} aria-hidden="true" /> Invite a student</h3>
                    <form onSubmit={invite} className="space-y-2">
                        <label htmlFor="invite-email" className="sr-only">Student email</label>
                        <input id="invite-email" type="email" className={inputCls} placeholder="student@school.edu" value={inv.data.email} onChange={(e) => inv.setData('email', e.target.value)} />
                        {inv.errors.email && <p role="alert" className="text-xs text-[#C81E51]">{inv.errors.email}</p>}
                        <Btn disabled={inv.processing}>Send invitation</Btn>
                    </form>
                    <p className="mt-2 text-xs text-gray-500">They get a notification with a link to join.</p>
                </Card>
            )}
        </div>
    );
}
