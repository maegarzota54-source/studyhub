import { useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, RotateCw, X } from 'lucide-react';
import { api } from '@/lib/api';

const MODES = [
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'multiple_choice', label: 'Multiple choice' },
    { id: 'situational', label: 'Situational' },
];

export default function StudyGeneratorModal({ item, onClose }) {
    const [mode, setMode] = useState('flashcards');
    const [items, setItems] = useState([]);
    const [index, setIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [selected, setSelected] = useState(null);
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const current = items[index];

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const generate = async () => {
        setLoading(true);
        setError('');
        setItems([]);
        try {
            const result = await api('POST', route('files.study', item.id), { mode });
            setItems(result.items);
            setIndex(0);
            setFlipped(false);
            setSelected(null);
            setAnswer('');
        } catch (response) {
            let message = 'Could not generate a study set. Please try again.';
            if (typeof response?.json === 'function') {
                const result = await response.json().catch(() => null);
                if (result?.message) message = result.message;
            } else if (response instanceof Error) {
                message = response.message;
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const move = (step) => {
        setIndex((currentIndex) => Math.min(items.length - 1, Math.max(0, currentIndex + step)));
        setFlipped(false);
        setSelected(null);
        setAnswer('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="study-generator-title">
            <section className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <header className="flex items-start gap-3 border-b border-gray-100 px-4 py-4 sm:px-6">
                    <BookOpen className="mt-0.5 shrink-0 text-hunter-700" size={21} />
                    <div className="min-w-0 flex-1">
                        <h2 id="study-generator-title" className="font-semibold text-slate-900">Study: {item.title}</h2>
                        <p className="mt-1 text-xs text-gray-500">Generated questions are based on this item.</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close study generator" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"><X size={20} /></button>
                </header>

                <div className="overflow-y-auto p-4 sm:p-6">
                    <p className="mb-3 text-sm font-medium text-slate-800">Choose a study mode</p>
                    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {MODES.map((option) => (
                            <button key={option.id} type="button" onClick={() => { setMode(option.id); setItems([]); setError(''); }}
                                aria-pressed={mode === option.id}
                                className={`rounded-lg border px-3 py-2 text-sm font-medium ${mode === option.id ? 'border-hunter-700 bg-hunter-100 text-hunter-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                        The note or file content will be sent to Google Gemini to make this study set. Gemini API usage may incur charges.
                    </p>
                    <button type="button" onClick={generate} disabled={loading}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-hunter-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-hunter-800 disabled:cursor-wait disabled:opacity-60">
                        <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Generating…' : items.length ? 'Generate a new set' : 'Generate study set'}
                    </button>
                    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

                    {current && (
                        <div className="mt-5 rounded-xl border border-gray-200 bg-cool-100 p-4 sm:p-5">
                            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {MODES.find((option) => option.id === mode)?.label} · {index + 1} of {items.length}
                            </p>
                            {mode === 'flashcards' && (
                                <button type="button" onClick={() => setFlipped((value) => !value)}
                                    className="min-h-44 w-full rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm">
                                    <span className="mb-3 block text-xs font-semibold uppercase text-hunter-700">{flipped ? 'Answer' : 'Question'} · click to flip</span>
                                    <span className="whitespace-pre-wrap text-base font-medium text-slate-900">{flipped ? current.answer : current.question}</span>
                                </button>
                            )}
                            {mode === 'multiple_choice' && (
                                <div>
                                    <p className="mb-4 font-medium text-slate-900">{current.question}</p>
                                    <div className="space-y-2">
                                        {current.options.map((option, optionIndex) => {
                                            const correct = optionIndex === current.correct_index;
                                            const chosen = selected === optionIndex;
                                            const style = selected === null ? 'border-gray-200 bg-white hover:border-hunter-700'
                                                : correct ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                                                    : chosen ? 'border-rose-400 bg-rose-50 text-rose-900' : 'border-gray-200 bg-white';
                                            return (
                                                <button key={`${optionIndex}-${option}`} type="button" onClick={() => setSelected(optionIndex)} disabled={selected !== null}
                                                    className={`w-full rounded-lg border p-3 text-left text-sm ${style}`}>
                                                    <span className="mr-2 font-semibold">{String.fromCharCode(65 + optionIndex)}.</span>{option}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {selected !== null && <p className="mt-3 text-sm text-slate-700">{current.explanation}</p>}
                                </div>
                            )}
                            {mode === 'situational' && (
                                <div>
                                    <p className="mb-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-800">{current.scenario}</p>
                                    <p className="mb-3 font-medium text-slate-900">{current.question}</p>
                                    <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={3}
                                        placeholder="Write your answer, then compare it with the suggested answer…" className="w-full rounded-lg border-gray-300 text-sm focus:border-hunter-700 focus:ring-hunter-700" />
                                    <details className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                                        <summary className="cursor-pointer text-sm font-semibold text-hunter-700">Show suggested answer</summary>
                                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{current.model_answer}</p>
                                        <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
                                            {current.key_points.map((point) => <li key={point}>{point}</li>)}
                                        </ul>
                                    </details>
                                </div>
                            )}
                            <div className="mt-5 flex items-center justify-between gap-3">
                                <button type="button" onClick={() => move(-1)} disabled={index === 0}
                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40"><ChevronLeft size={16} /> Previous</button>
                                <button type="button" onClick={() => move(1)} disabled={index === items.length - 1}
                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40">Next <ChevronRight size={16} /></button>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
