import { useEffect, useRef, useState } from 'react';

const SETS = {
    '😀': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤔', '🤗', '😎', '🥳', '😴', '😢', '😭', '😤', '😡', '😱', '🥺', '🤯'],
    '👍': ['👍', '👎', '👏', '🙌', '🙏', '💪', '👌', '✌️', '🤞', '🤝', '👋', '🫡', '👀', '🔥', '✨', '🎉', '💯', '✅', '❌', '❓', '❗', '💡', '⭐', '🏆'],
    '📚': ['📚', '📖', '📝', '✏️', '📒', '📎', '📌', '🗓️', '⏰', '💻', '🧠', '🔬', '🧪', '📐', '🎓', '🏫', '☕', '🍕', '🎧', '🎯', '📈', '🧮', '🌙', '☀️'],
    '❤️': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕', '💖', '💗', '💞', '💘', '🌈', '🌸', '🌟', '🎈', '🎁', '🐶', '🐱', '🦋'],
};

/** Small emoji popover. Calls onPick(emoji) for each tap and stays open so several can be added. */
export default function EmojiPicker({ onPick, onClose, className = '' }) {
    const [tab, setTab] = useState(Object.keys(SETS)[0]);
    const box = useRef(null);

    useEffect(() => {
        const away = (e) => { if (box.current && !box.current.contains(e.target)) onClose(); };
        const esc = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
    }, [onClose]);

    return (
        <div ref={box} role="dialog" aria-label="Choose an emoji"
            className={`z-30 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-2 shadow-xl ${className}`}>
            <div className="mb-1 flex gap-1 border-b border-gray-100 pb-1">
                {Object.keys(SETS).map((k) => (
                    <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
                        className={`rounded-lg px-2 py-1 text-lg ${tab === k ? 'bg-hunter-100' : 'hover:bg-gray-100'}`}>{k}</button>
                ))}
            </div>
            <div className="grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto">
                {SETS[tab].map((e) => (
                    <button key={e} type="button" onClick={() => onPick(e)} aria-label={`Insert ${e}`}
                        className="rounded-md p-1 text-xl transition-transform hover:scale-125 hover:bg-gray-100">{e}</button>
                ))}
            </div>
        </div>
    );
}
