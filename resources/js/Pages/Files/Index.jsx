import { useEffect, useRef, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { Download, Eye, X } from 'lucide-react';
import AppLayout, { Btn, Card, inputCls } from '@/Layouts/AppLayout';

const size = (b) => (b ? (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.ceil(b / 1e3) + ' KB') : '');

/** Renders a .docx in the browser (library is loaded only when a Word file is opened). */
function DocxView({ url }) {
  const box = useRef(null);
  const [state, setState] = useState('loading');
  const [why, setWhy] = useState('');
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [{ renderAsync }, res] = await Promise.all([import('docx-preview'), fetch(url, { credentials: 'same-origin' })]);
        if (!res.ok) throw new Error('Server answered ' + res.status + ' for ' + url);
        const data = await res.arrayBuffer();
        if (dead || !box.current) return;
        box.current.innerHTML = '';
        await renderAsync(data, box.current, undefined, { inWrapper: true, ignoreWidth: false, breakPages: true });
        if (!dead) setState('ok');
      } catch (e) { console.error('Preview failed', e); if (!dead) { setWhy(String(e?.message || e)); setState('error'); } }
    })();
    return () => { dead = true; };
  }, [url]);
  return (
    <>
      {state === 'loading' && <p className="p-6 text-center text-sm text-gray-500">Loading document…</p>}
      {state === 'error' && <div className="p-6 text-center text-sm text-gray-500"><p>Could not preview this Word file. Use Download to open it.</p>{why && <p className="mt-2 break-words text-xs text-gray-400">Details: {why}</p>}</div>}
      <div ref={box} className="max-h-[70vh] overflow-auto rounded-lg bg-white" />
    </>
  );
}

/** Fetches the stored file and hands the bytes to a renderer. Libraries load only when needed. */
function OfficeView({ url, kind }) {
  const box = useRef(null);
  const [state, setState] = useState('loading');
  const [sheet, setSheet] = useState(null);
  const [why, setWhy] = useState('');
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Server answered ' + res.status + ' for ' + url);
        const data = await res.arrayBuffer();
        if (dead) return;
        if (kind === 'pptx') {
          const { init } = await import('pptx-preview');
          if (dead || !box.current) return;
          box.current.innerHTML = '';
          const w = Math.min(box.current.clientWidth || 800, 900);
          const viewer = init(box.current, { width: w, height: Math.round((w * 9) / 16), mode: 'list' });
          await viewer.preview(data);
        } else {
          const mod = await import('read-excel-file/browser');
          const sheets = await mod.default(new Blob([data]));
          if (dead) return;
          setSheet(sheets);
        }
        if (!dead) setState('ok');
      } catch (e) { console.error('Preview failed', e); if (!dead) { setWhy(String(e?.message || e)); setState('error'); } }
    })();
    return () => { dead = true; };
  }, [url, kind]);
  const first = sheet?.[0];
  const rows = first?.data?.slice(0, 200) ?? [];
  return (
    <>
      {state === 'loading' && <p className="p-6 text-center text-sm text-gray-500">Loading preview…</p>}
      {state === 'error' && <div className="p-6 text-center text-sm text-gray-500"><p>Could not preview this file. Use Download to open it.</p>{why && <p className="mt-2 break-words text-xs text-gray-400">Details: {why}</p>}</div>}
      {kind === 'pptx' && <div ref={box} className="max-h-[70vh] overflow-auto rounded-lg bg-white" />}
      {kind === 'xlsx' && state === 'ok' && (
        <div className="max-h-[70vh] overflow-auto rounded-lg bg-white">
          <p className="border-b border-gray-100 px-3 py-2 text-xs text-gray-500">Sheet: {first?.sheet}{first?.data?.length > 200 ? ` · showing first 200 of ${first.data.length} rows` : ''}</p>
          <table className="min-w-full text-sm">
            <tbody>{rows.map((r, ri) => (
              <tr key={ri} className={ri === 0 ? 'bg-gray-50 font-semibold' : 'border-t border-gray-100'}>
                {r.slice(0, 30).map((c, ci) => <td key={ci} className="whitespace-nowrap px-3 py-1.5">{c instanceof Date ? c.toLocaleDateString() : String(c ?? '')}</td>)}
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Pop-up that shows the contents of a note or file without downloading it. */
function PreviewModal({ item, onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  const url = route('files.preview', item.id);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Preview of ${item.title}`}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
          <h3 className="min-w-0 flex-1 truncate font-semibold">{item.title}</h3>
          {item.path && <a href={route('files.download', item.id)} className="inline-flex items-center gap-1 text-sm text-hunter-700 underline"><Download size={14} /> Download</a>}
          <button onClick={onClose} aria-label="Close preview" className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-cool-100 p-4">
          {item.body && <p className="mb-3 whitespace-pre-wrap rounded-lg bg-white p-4 text-sm">{item.body}</p>}
          {item.preview === 'image' && <img src={url} alt={item.title} className="mx-auto max-h-[70vh] rounded-lg object-contain" />}
          {(item.preview === 'pdf' || item.preview === 'text') && <iframe src={url} title={item.title} className="h-[70vh] w-full rounded-lg border-0 bg-white" />}
          {item.preview === 'docx' && <DocxView url={url} />}
          {(item.preview === 'pptx' || item.preview === 'xlsx') && <OfficeView url={url} kind={item.preview} />}
          {item.preview === 'audio' && <audio src={url} controls className="w-full" />}
          {item.preview === 'video' && <video src={url} controls className="mx-auto max-h-[70vh] rounded-lg" />}
          {!item.preview && item.path && <p className="p-6 text-center text-sm text-gray-500">A preview is not available for this type of file (for example old .doc, .ppt or .xls files). Use Download to open it.</p>}
          {!item.body && !item.path && <p className="p-6 text-center text-sm text-gray-500">This item is empty.</p>}
        </div>
      </div>
    </div>
  );
}

export default function Files({ items, groups, filters }) {
  const [previewId, setPreviewId] = useState(null);
  const previewItem = items.find((i) => i.id === previewId);
  const f = useForm({ kind: 'note', title: '', body: '', study_group_id: '', file: null });
  const filter = (k, v) => router.get(route('files.index'), { ...filters, [k]: v || undefined }, { preserveState: true });
  return (
    <AppLayout title="Notes & Files">
      <Head title="Notes & Files" />
      <Card className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); f.post(route('files.store'), { forceFormData: true, onSuccess: () => f.reset('title', 'body', 'file') }); }} className="grid gap-2 md:grid-cols-4">
          <select className={inputCls} value={f.data.kind} onChange={(e) => f.setData('kind', e.target.value)}><option value="note">Note</option><option value="file">File</option><option value="module">Study module</option></select>
          <select className={inputCls} value={f.data.study_group_id} onChange={(e) => f.setData('study_group_id', e.target.value)}><option value="">Personal</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select>
          <input className={`${inputCls} md:col-span-2`} placeholder="Title" value={f.data.title} onChange={(e) => f.setData('title', e.target.value)} />
          <textarea className={`${inputCls} md:col-span-3`} placeholder="Note text (optional)" value={f.data.body} onChange={(e) => f.setData('body', e.target.value)} />
          <input type="file" className={inputCls} onChange={(e) => f.setData('file', e.target.files[0])} />
          {Object.values(f.errors).map((m) => <p key={m} className="text-xs text-raspberry-600 md:col-span-4">{m}</p>)}
          <Btn disabled={f.processing}>Save</Btn>
        </form>
      </Card>
      <div className="mb-3 flex gap-2">
        <select className="rounded-lg border-gray-300 text-sm" value={filters.group_id ?? ''} onChange={(e) => filter('group_id', e.target.value)}>
          <option value="">All sources</option><option value="personal">Personal</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
        <select className="rounded-lg border-gray-300 text-sm" value={filters.kind ?? ''} onChange={(e) => filter('kind', e.target.value)}>
          <option value="">All types</option><option value="note">Notes</option><option value="file">Files</option><option value="module">Modules</option>
        </select>
      </div>
      <Card className="divide-y divide-gray-100 p-0">
        {items.length === 0 && <p className="p-5 text-sm text-gray-500">Nothing here yet. Save a note or upload a file.</p>}
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{i.title}</p>
              <p className="text-xs text-gray-500">{i.kind} · {i.group?.title ?? 'Personal'} · {i.user.name} {size(i.size)}{i.message_id && <span className="ml-2 rounded bg-hunter-100 px-1.5 text-hunter-800">from chat</span>}</p></div>
            {(i.preview || i.body || i.path) && <button className="inline-flex items-center gap-1 text-sm text-hunter-700 hover:underline" onClick={() => setPreviewId(i.id)}><Eye size={14} /> Preview</button>}
            {i.path && <a className="text-sm text-hunter-700 underline" href={route('files.download', i.id)}>Download</a>}
            <button className="text-sm text-raspberry-600" onClick={() => confirm('Delete?') && router.delete(route('files.destroy', i.id))}>Delete</button>
          </div>
        ))}
      </Card>
      {previewItem && <PreviewModal key={previewItem.id} item={previewItem} onClose={() => setPreviewId(null)} />}
    </AppLayout>
  );
}
