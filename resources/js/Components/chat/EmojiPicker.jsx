import { useEffect, useRef, useState } from 'react';

const SETS = {
    Smileys: '😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤗 🤔 🤨 😐 🙄 😏 😴 😌 😎 🤓 🥳 😢 😭 😤 😡 🤯 😱 😳 🥺'.split(' '),
    Hands: '👍 👎 👌 ✌️ 🤞 🤟 👏 🙌 🤝 🙏 💪 ✍️ 👀 🧠 👋 🫶'.split(' '),
    Study: '📚 📖 📝 ✏️ 📌 📎 💡 🎯 🏆 ⏰ 📅 💻 🔬 🧪 🧮 🎓 ✅ ❌ ❓ ❗ 🔥 ⭐ 🎉 ☕'.split(' '),
    Hearts: '❤️ 🧡 💛 💚 💙 💜 🖤 💔 ✨ 💯 🌟 🌈'.split(' '),
};

/** A small emoji popover. Click outside or press Escape to close. */
export default function EmojiPicker({ onPick, onClose }) {
    const [tab, setTab] = useState('Smileys');
    const box = useRef(null);

    useEffect(() => {
        const away = (e) => { if (box.current && !box.current.contains(e.target)) onClose(); };
        const esc = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
    }, [onClose]);

    return (
        <div ref={box} role="dialog" aria-label="Emoji" className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-2xl border border-black/10 bg-[#F5EFE6] p-2 text-[#0A1F44] shadow-xl">
            <div className="mb-2 flex gap-1" role="tablist">
                {Object.keys(SETS).map((k) => (
                    <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${tab === k ? 'bg-[#2EC4B6]' : 'hover:bg-black/10'}`}>{k}</button>
                ))}
            </div>
            <div className="grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto">
                {SETS[tab].map((e) => (
                    <button key={e} type="button" onClick={() => onPick(e)} aria-label={`Insert ${e}`} className="rounded-lg p-1 text-xl transition-transform hover:scale-125 hover:bg-black/10">{e}</button>
                ))}
            </div>
        </div>
    );
}
