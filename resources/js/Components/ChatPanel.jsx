import { useEffect, useRef, useState } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import { Download, Flag, Paperclip, Reply, Save } from 'lucide-react';
import { Btn, inputCls } from '@/Layouts/AppLayout';

const KINDS = { message: 'Message', comment: 'Comment', answer: 'Answer', suggestion: 'Suggestion' };

/** Shared by group chat and DMs. `channel` is the private Echo channel name; `postUrl` the form target. */
export default function ChatPanel({ messages, channel, postUrl, only = ['messages'], threaded = false }) {
  const me = usePage().props.auth.user;
  const form = useForm({ body: '', kind: 'message', parent_id: null, attachment: null });
  const [replyTo, setReplyTo] = useState(null);
  const end = useRef(null);

  useEffect(() => {                       // live updates: event says "something new", Inertia refetches props
    const ch = window.Echo?.private(channel).listen('MessageSent', () => router.reload({ only }));
    return () => window.Echo?.leave(channel);
  }, [channel]);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [messages.length]);

  const send = (e) => {
    e.preventDefault();
    form.transform((d) => ({ ...d, parent_id: replyTo?.id ?? null })).post(postUrl, {
      forceFormData: true, preserveScroll: true, onSuccess: () => { form.reset(); setReplyTo(null); },
    });
  };

  const Bubble = ({ m, nested }) => (
    <div className={`${nested ? 'ml-8 mt-2' : ''} flex gap-2`}>
      <img src={m.sender.avatar_url ?? `https://ui-avatars.com/api/?background=355E3B&color=fff&name=${m.sender.name}`} className="h-8 w-8 rounded-full" alt="" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500"><b className="text-slate-900">{m.sender.name}</b>
          {m.kind !== 'message' && <span className="ml-2 rounded bg-raspberry-500/10 px-1.5 text-raspberry-600">{KINDS[m.kind]}</span>}
          <span className="ml-2">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></p>
        {m.body && <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>}
        {m.attachment_name && (
          <a href={route('messages.attachment', m.id)} className="mt-1 inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs">
            <Download size={12} /> {m.attachment_name}
          </a>
        )}
        <div className="mt-1 flex gap-3 text-xs text-gray-500">
          {threaded && !nested && <button onClick={() => setReplyTo(m)} className="hover:text-hunter-700"><Reply size={12} className="inline" /> Reply</button>}
          {m.attachment_name && <button onClick={() => router.post(route('messages.save', m.id), {}, { preserveScroll: true })} className="hover:text-hunter-700"><Save size={12} className="inline" /> Save to Notes & Files</button>}
          {m.sender_id !== me.id && <button onClick={() => router.post(route('messages.flag', m.id), {}, { preserveScroll: true })} className="hover:text-raspberry-600"><Flag size={12} className="inline" /> Report</button>}
        </div>
        {m.replies?.map((r) => <Bubble key={r.id} m={r} nested />)}
      </div>
    </div>
  );

  return (
    <div className="flex h-[32rem] flex-col rounded-xl border border-gray-200 bg-white">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-sm text-gray-500">No messages yet. Say hello.</p>}
        {messages.map((m) => <Bubble key={m.id} m={m} />)}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="border-t border-gray-200 p-3">
        {replyTo && <p className="mb-2 text-xs text-gray-500">Replying to {replyTo.sender.name} · <button type="button" onClick={() => setReplyTo(null)} className="underline">cancel</button></p>}
        <div className="flex gap-2">
          {threaded && (
            <select value={form.data.kind} onChange={(e) => form.setData('kind', e.target.value)} className="rounded-lg border border-gray-300 text-sm">
              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          <input value={form.data.body} onChange={(e) => form.setData('body', e.target.value)} placeholder="Type a message…" className={inputCls} />
          <label className="flex cursor-pointer items-center rounded-lg border border-gray-300 px-3" title="Attach a file">
            <Paperclip size={16} /><input type="file" className="sr-only" onChange={(e) => form.setData('attachment', e.target.files[0])} />
          </label>
          <Btn disabled={form.processing}>Send</Btn>
        </div>
        {form.data.attachment && <p className="mt-1 text-xs text-gray-500">{form.data.attachment.name}</p>}
        {form.errors.body && <p className="mt-1 text-xs text-raspberry-600">{form.errors.body}</p>}
      </form>
    </div>
  );
}
