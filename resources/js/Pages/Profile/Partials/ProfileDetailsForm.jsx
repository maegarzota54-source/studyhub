import { useEffect, useRef, useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { Btn, inputCls } from '@/Layouts/AppLayout';
import resizeImage from '@/utils/resizeImage';

export default function ProfileDetailsForm({ status }) {
    const user = usePage().props.auth.user;
    const prefs = user.study_preferences ?? {};

    const form = useForm({
        name: user.name,
        email: user.email,
        bio: user.bio ?? '',
        avatar: null,
        study_preferences: {
            skill_level: prefs.skill_level ?? '',
            goal: prefs.goal ?? '',
            mode: prefs.mode ?? '',
        },
    });

    // Preview of the newly picked photo (created once, cleaned up when it changes).
    const [preview, setPreview] = useState(null);
    const fileInput = useRef(null);
    useEffect(() => {
        if (!form.data.avatar) { setPreview(null); return; }
        const url = URL.createObjectURL(form.data.avatar);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [form.data.avatar]);

    const pickPhoto = async (e) => {
        const file = e.target.files[0];
        form.setData('avatar', file ? await resizeImage(file) : null);
    };

    const setPref = (key) => (e) =>
        form.setData('study_preferences', { ...form.data.study_preferences, [key]: e.target.value });

    const submit = (e) => {
        e.preventDefault();
        // Files can't be sent with a real PATCH, so send a POST and spoof the method.
        // transform() only registers the callback (it returns nothing), so it is called on its own line.
        form.transform((data) => ({ ...data, _method: 'patch' }));
        form.post(route('profile.update'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { form.setData('avatar', null); if (fileInput.current) fileInput.current.value = ''; },
        });
    };

    const err = (k) => form.errors[k] && <p className="mt-1 text-xs text-raspberry-600">{form.errors[k]}</p>;

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center gap-4">
                <img
                    src={preview ?? user.avatar_url}
                    alt="" className="h-16 w-16 rounded-full object-cover"
                />
                <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor="avatar">Profile photo</label>
                    <input id="avatar" ref={fileInput} type="file" accept="image/*" className="text-sm"
                        onChange={pickPhoto} />
                    <p className="mt-1 text-xs text-gray-500">JPG, PNG or WebP. It is resized automatically.</p>
                    {err('avatar')}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor="name">Name</label>
                    <input id="name" className={inputCls} value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                    {err('name')}
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
                    <input id="email" type="email" className={inputCls} value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                    {err('email')}
                </div>
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="bio">Bio</label>
                <textarea id="bio" rows="3" maxLength="500" className={inputCls} value={form.data.bio} onChange={(e) => form.setData('bio', e.target.value)} />
                {err('bio')}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor="skill">Skill level</label>
                    <select id="skill" className={inputCls} value={form.data.study_preferences.skill_level} onChange={setPref('skill_level')}>
                        <option value="">Not set</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                    </select>
                    {err('study_preferences.skill_level')}
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor="goal">Study goal</label>
                    <input id="goal" className={inputCls} placeholder="e.g. Pass the board exam" value={form.data.study_preferences.goal} onChange={setPref('goal')} />
                    {err('study_preferences.goal')}
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor="mode">Study mode</label>
                    <select id="mode" className={inputCls} value={form.data.study_preferences.mode} onChange={setPref('mode')}>
                        <option value="">Not set</option>
                        <option value="online">Online</option>
                        <option value="in-person">In person</option>
                    </select>
                    {err('study_preferences.mode')}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Btn disabled={form.processing}>Save changes</Btn>
                {status === 'profile-updated' && <span className="text-sm text-hunter-700">Saved.</span>}
            </div>
        </form>
    );
}