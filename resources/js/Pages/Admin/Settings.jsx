import { Head, useForm } from '@inertiajs/react';
import AdminLayout, { Panel, inputCls } from '@/Layouts/AdminLayout';

export default function Settings({ settings }) {
    const f = useForm(settings);
    return (
        <AdminLayout title="Settings" crumbs={[['Settings']]}>
            <Head title="Settings" />
            <form onSubmit={(e) => { e.preventDefault(); f.post(route('admin.settings.save'), { preserveScroll: true }); }} className="grid max-w-3xl gap-6">
                <Panel title="Announcement banner">
                    <div className="space-y-3 p-5">
                        <p className="text-sm text-gray-600">Shown at the top of every student page while enabled. Good for exam weeks or maintenance notices.</p>
                        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={f.data.announcement_enabled} onChange={(e) => f.setData('announcement_enabled', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#355E3B] focus:ring-[#355E3B]" /> Show the banner</label>
                        <div>
                            <label htmlFor="ann" className="mb-1 block text-sm font-medium">Message</label>
                            <textarea id="ann" rows="3" maxLength="300" className={inputCls} value={f.data.announcement} onChange={(e) => f.setData('announcement', e.target.value)} />
                            <p className="mt-1 text-xs text-gray-500">{f.data.announcement.length}/300</p>
                            {f.errors.announcement && <p className="text-sm text-[#C81E51]">{f.errors.announcement}</p>}
                        </div>
                        {f.data.announcement_enabled && f.data.announcement && <div className="rounded-lg bg-[#E30B5C] px-4 py-2 text-sm text-white"><span className="mr-2 text-xs opacity-80">Preview</span>{f.data.announcement}</div>}
                    </div>
                </Panel>
                <Panel title="Study groups">
                    <div className="p-5">
                        <label htmlFor="max" className="mb-1 block text-sm font-medium">Largest allowed group size</label>
                        <input id="max" type="number" min="2" max="200" className={`${inputCls} !w-32`} value={f.data.max_group_size} onChange={(e) => f.setData('max_group_size', e.target.value)} />
                        <p className="mt-1 text-xs text-gray-500">Applies to newly created groups.</p>
                        {f.errors.max_group_size && <p className="text-sm text-[#C81E51]">{f.errors.max_group_size}</p>}
                    </div>
                </Panel>
                <div><button disabled={f.processing} className="rounded-lg bg-[#355E3B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2a4a2f] disabled:opacity-60">{f.processing ? 'Saving…' : 'Save settings'}</button></div>
            </form>
        </AdminLayout>
    );
}
