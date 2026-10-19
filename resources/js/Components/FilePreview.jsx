import { useEffect, useRef, useState } from 'react';

function DocxView({ url }) {
  const box = useRef(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [{ renderAsync }, res] = await Promise.all([import('docx-preview'), fetch(url, { credentials: 'same-origin' })]);
        if (!res.ok) throw new Error('Server answered ' + res.status);
        const data = await res.arrayBuffer();
        if (dead || !box.current) return;
        box.current.innerHTML = '';
        await renderAsync(data, box.current, undefined, { inWrapper: true, ignoreWidth: false, breakPages: true });
        if (!dead) setState('ok');
      } catch (e) {
        console.error('Preview failed', e);
        if (!dead) setState('error');
      }
    })();
    return () => { dead = true; };
  }, [url]);

  return (
    <>
      {state === 'loading' && <p className="p-6 text-center text-sm text-gray-500">Loading document…</p>}
      {state === 'error' && <p className="p-6 text-center text-sm text-gray-500">Could not preview this Word file. Use Download to open it.</p>}
      <div ref={box} className="max-h-[70vh] overflow-auto rounded-lg bg-white" />
    </>
  );
}

function OfficeView({ url, kind }) {
  const box = useRef(null);
  const [state, setState] = useState('loading');
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Server answered ' + res.status);
        const data = await res.arrayBuffer();
        if (dead) return;
        if (kind === 'pptx') {
          const { init } = await import('pptx-preview');
          if (dead || !box.current) return;
          box.current.innerHTML = '';
          const width = Math.min(box.current.clientWidth || 800, 900);
          const viewer = init(box.current, { width, height: Math.round((width * 9) / 16), mode: 'list' });
          await viewer.preview(data);
        } else {
          const mod = await import('read-excel-file/browser');
          const sheets = await mod.default(new Blob([data]));
          if (dead) return;
          setSheet(sheets);
        }
        if (!dead) setState('ok');
      } catch (e) {
        console.error('Preview failed', e);
        if (!dead) setState('error');
      }
    })();
    return () => { dead = true; };
  }, [url, kind]);

  const first = sheet?.[0];
  return (
    <>
      {state === 'loading' && <p className="p-6 text-center text-sm text-gray-500">Loading preview…</p>}
      {state === 'error' && <p className="p-6 text-center text-sm text-gray-500">Could not preview this file. Use Download to open it.</p>}
      {kind === 'pptx' && <div ref={box} className="max-h-[70vh] overflow-auto rounded-lg bg-white" />}
      {kind === 'xlsx' && state === 'ok' && (
        <div className="max-h-[70vh] overflow-auto rounded-lg bg-white">
          <p className="border-b border-gray-100 px-3 py-2 text-xs text-gray-500">
            Sheet: {first?.sheet}{first?.data?.length > 200 ? ` · showing first 200 of ${first.data.length} rows` : ''}
          </p>
          <table className="min-w-full text-sm"><tbody>
            {(first?.data?.slice(0, 200) ?? []).map((row, ri) => (
              <tr key={ri} className={ri === 0 ? 'bg-gray-50 font-semibold' : 'border-t border-gray-100'}>
                {row.slice(0, 30).map((cell, ci) => (
                  <td key={ci} className="whitespace-nowrap px-3 py-1.5">{cell instanceof Date ? cell.toLocaleDateString() : String(cell ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </>
  );
}

function FilePreview({ item, url: previewUrl }) {
  const url = previewUrl ?? item.preview_url ?? route('files.preview', item.id);
  return (
    <div className="overflow-hidden rounded-lg bg-cool-100 p-3" aria-label={`Preview of ${item.title}`}>
      {item.body && <p className="mb-3 whitespace-pre-wrap rounded-lg bg-white p-4 text-sm">{item.body}</p>}
      {item.preview === 'image' && <img src={url} alt={item.title} className="mx-auto max-h-[70vh] rounded-lg object-contain" />}
      {(item.preview === 'pdf' || item.preview === 'text') && <iframe src={url} title={item.title} className="h-[70vh] w-full rounded-lg border-0 bg-white" />}
      {item.preview === 'docx' && <DocxView url={url} />}
      {(item.preview === 'pptx' || item.preview === 'xlsx') && <OfficeView url={url} kind={item.preview} />}
      {item.preview === 'audio' && <audio src={url} controls className="w-full" />}
      {item.preview === 'video' && <video src={url} controls className="mx-auto max-h-[70vh] rounded-lg" />}
      {!item.preview && (item.path || previewUrl) && <p className="p-6 text-center text-sm text-gray-500">A preview is not available for this type of file. Use Download to open it.</p>}
      {!item.body && !item.path && !previewUrl && <p className="p-6 text-center text-sm text-gray-500">This item is empty.</p>}
    </div>
  );
}

export default FilePreview;
