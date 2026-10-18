import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { Btn } from '@/Layouts/AppLayout';

const TABS = [['flashcards', 'Flashcards'], ['multiple_choice', 'Multiple choice'], ['situational', 'Situational']];

/** Flip cards: question on the front, answer on the back. */
function Flashcards({ cards }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  if (!cards.length) return <Empty what="flashcards" />;
  const c = cards[i];
  const go = (d) => { setI((n) => (n + d + cards.length) % cards.length); setFlip(false); };
  return (
    <div>
      <button type="button" onClick={() => setFlip((f) => !f)} aria-label="Flip card"
        className={`flex min-h-[200px] w-full items-center justify-center rounded-2xl border-2 p-6 text-center text-lg shadow-sm transition ${flip ? 'border-hunter-700 bg-hunter-50' : 'border-gray-200 bg-white'}`}>
        <span>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">{flip ? 'Answer' : 'Question'}</span>
          <span className="whitespace-pre-wrap">{flip ? c.back : c.front}</span>
        </span>
      </button>
      <div className="mt-3 flex items-center justify-between">
        <Btn variant="ghost" onClick={() => go(-1)} aria-label="Previous card"><ChevronLeft size={16} /></Btn>
        <span className="text-sm text-gray-500">{i + 1} / {cards.length} · click the card to flip</span>
        <Btn variant="ghost" onClick={() => go(1)} aria-label="Next card"><ChevronRight size={16} /></Btn>
      </div>
    </div>
  );
}

/** One question with options; shows right/wrong and the explanation once an option is chosen. */
function Choice({ q, picked, onPick }) {
  const done = picked != null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-3 whitespace-pre-wrap text-sm font-medium">{q.question ?? q.situation}</p>
      <div className="space-y-2">
        {q.options.map((o, k) => {
          const right = k === q.correct;
          const cls = !done ? 'border-gray-200 hover:bg-cool-100' : right ? 'border-green-600 bg-green-50' : k === picked ? 'border-raspberry-600 bg-red-50' : 'border-gray-200 opacity-60';
          return (
            <button key={k} type="button" disabled={done} onClick={() => onPick(k)} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${cls}`}>
              <span className="mr-2 font-semibold text-gray-400">{String.fromCharCode(65 + k)}.</span>{o}
              {done && right && <span className="ml-2 text-xs font-semibold text-green-700">✓ correct</span>}
              {done && !right && k === picked && <span className="ml-2 text-xs font-semibold text-raspberry-600">✗ your answer</span>}
            </button>
          );
        })}
      </div>
      {done && q.explanation && <p className="mt-3 rounded-lg bg-cool-100 p-3 text-xs text-gray-600"><b>Explanation:</b> {q.explanation}</p>}
    </div>
  );
}

function Quiz({ list, what }) {
  const [answers, setAnswers] = useState({});
  if (!list.length) return <Empty what={what} />;
  const total = list.length, answered = Object.keys(answers).length;
  const score = list.filter((q, k) => answers[k] === q.correct).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Answered {answered} / {total}{answered === total && <b className="ml-2 text-hunter-700">Score: {score} / {total}</b>}</span>
        {answered > 0 && <button type="button" onClick={() => setAnswers({})} className="inline-flex items-center gap-1 text-hunter-700 hover:underline"><RotateCcw size={13} /> Start over</button>}
      </div>
      {list.map((q, k) => <Choice key={k} q={q} picked={answers[k]} onPick={(v) => setAnswers((a) => ({ ...a, [k]: v }))} />)}
    </div>
  );
}

/** Situation + options when we could build them, otherwise a "show answer" reveal. */
function Situational({ list }) {
  const [shown, setShown] = useState({});
  const [answers, setAnswers] = useState({});
  if (!list.length) return <Empty what="situational questions" />;
  return (
    <div className="space-y-3">
      {list.map((q, k) => q.options ? (
        <Choice key={k} q={q} picked={answers[k]} onPick={(v) => setAnswers((a) => ({ ...a, [k]: v }))} />
      ) : (
        <div key={k} className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-3 whitespace-pre-wrap text-sm font-medium">{q.situation}</p>
          {shown[k]
            ? <p className="whitespace-pre-wrap rounded-lg bg-hunter-50 p-3 text-sm"><b>Answer:</b> {q.answer}</p>
            : <Btn variant="ghost" onClick={() => setShown((s) => ({ ...s, [k]: true }))}>Show answer</Btn>}
        </div>
      ))}
    </div>
  );
}

function Empty({ what }) {
  return <p className="rounded-lg bg-white p-6 text-center text-sm text-gray-500">No {what} could be made from this text.</p>;
}

/** Study pop-up for a note or file. Questions are generated on the server from the text (no AI). */
export default function StudyModal({ item, onClose }) {
  const [tab, setTab] = useState('flashcards');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  useEffect(() => {
    let dead = false;
    fetch(route('files.study', item.id), { credentials: 'same-origin', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
      .then((r) => { if (!r.ok) throw new Error('Server answered ' + r.status); return r.json(); })
      .then((d) => { if (!dead) setData(d); })
      .catch((e) => { if (!dead) setError(String(e?.message || e)); });
    return () => { dead = true; };
  }, [item.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Study ${item.title}`}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
          <h3 className="min-w-0 flex-1 truncate font-semibold">Study: {item.title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="flex gap-1 border-b border-gray-100 px-5 pt-2" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`px-3 py-2 text-sm ${tab === k ? 'border-b-2 border-raspberry-600 font-semibold text-hunter-700' : 'text-gray-500'}`}>
              {label}{data && <span className="ml-1 text-xs text-gray-400">({data[k].length})</span>}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-cool-100 p-4">
          {!data && !error && <p className="p-6 text-center text-sm text-gray-500">Making questions from your notes…</p>}
          {error && <p className="p-6 text-center text-sm text-raspberry-600">Could not load the questions. {error}</p>}
          {data && (
            <>
              {data.source === 'ai' && <p className="mb-3 rounded-lg bg-hunter-50 p-3 text-xs text-hunter-800">Made with AI (Google Gemini) from your notes. AI can make mistakes, so double-check the answers.</p>}
              {data.source === 'basic' && <p className="mb-3 text-xs text-gray-500">Basic questions made without AI.</p>}
              {data.notes.map((n, k) => <p key={k} className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{n}</p>)}
              {tab === 'flashcards' && <Flashcards key="f" cards={data.flashcards} />}
              {tab === 'multiple_choice' && <Quiz key="m" list={data.multiple_choice} what="multiple-choice questions" />}
              {tab === 'situational' && <Situational key="s" list={data.situational} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
