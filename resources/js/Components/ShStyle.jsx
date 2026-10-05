import { Head } from '@inertiajs/react';

/** Global styles for the landing + auth pages. Plain CSS, so it works whether or not tailwind.config.js has the StudyHub colors. */
const css = `
.sh-display{font-family:'Bricolage Grotesque',Figtree,system-ui,sans-serif;letter-spacing:-0.02em}
.sh-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border-radius:.75rem;padding:.75rem 1.25rem;font-weight:600;font-size:.95rem;cursor:pointer;transition:transform .15s,box-shadow .2s,background .2s}
.sh-btn:active{transform:scale(.97)}
.sh-btn[disabled]{opacity:.6;cursor:wait}
.sh-btn-primary{background:#355E3B;color:#fff}
.sh-btn-primary:hover{background:#2a4a2f;box-shadow:0 10px 24px -10px #355E3B}
.sh-btn-accent{background:#E30B5C;color:#fff}
.sh-btn-accent:hover{background:#C81E51;box-shadow:0 10px 24px -10px #E30B5C}
.sh-btn-ghost{background:#fff;color:#1F2937;border:1px solid #D1D5DB}
.sh-btn-ghost:hover{background:#F3F4F6}
.sh-btn:focus-visible,.sh-chip:focus-visible,.sh-avatar:focus-visible,.sh-tab:focus-visible{outline:3px solid #E30B5C;outline-offset:2px}
.sh-input{width:100%;border:1.5px solid #D1D5DB;border-radius:.75rem;padding:.8rem 1rem;background:#fff;color:#1F2937;transition:border-color .15s,box-shadow .15s}
.sh-input:focus{outline:none;border-color:#355E3B;box-shadow:0 0 0 4px rgba(53,94,59,.16)}
.sh-input.err{border-color:#E30B5C}
.sh-chip{border:1.5px solid #D1D5DB;border-radius:999px;padding:.4rem .95rem;font-size:.875rem;font-weight:500;background:#fff;color:#1F2937;cursor:pointer;transition:all .15s}
.sh-chip:hover{border-color:#355E3B}
.sh-chip[aria-pressed=true]{background:#355E3B;border-color:#355E3B;color:#fff}
.sh-tab{display:flex;align-items:center;gap:.6rem;width:100%;text-align:left;padding:.85rem 1rem;border-radius:.85rem;border:1.5px solid transparent;cursor:pointer;transition:all .2s;color:#1F2937}
.sh-tab:hover{background:#fff}
.sh-tab[aria-selected=true]{background:#fff;border-color:#355E3B;box-shadow:0 12px 28px -18px #355E3B}
.sh-card{background:#fff;border:1px solid #E5E7EB;border-radius:1rem}
@keyframes sh-spin{to{transform:rotate(360deg)}}
@keyframes sh-pop{0%{opacity:0;transform:scale(.3)}70%{transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
@keyframes sh-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes sh-shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-6px)}40%,60%{transform:translateX(6px)}}
@keyframes sh-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes sh-pulse{0%{transform:scale(.9);opacity:.55}100%{transform:scale(1.5);opacity:0}}
@keyframes sh-blink{0%,80%,100%{opacity:.25}40%{opacity:1}}
.sh-orbit{animation:sh-spin 70s linear infinite}
.sh-counter{animation:sh-spin 70s linear infinite reverse}
.sh-stage:hover .sh-orbit,.sh-stage:hover .sh-counter{animation-play-state:paused}
.sh-pop{animation:sh-pop .6s cubic-bezier(.2,.9,.3,1.2) both}
.sh-fade{animation:sh-fade .5s ease both}
.sh-shake{animation:sh-shake .5s}
.sh-grow{transform-origin:bottom;animation:sh-grow .7s cubic-bezier(.2,.8,.2,1) both}
.sh-pulse{animation:sh-pulse 2.6s ease-out infinite}
.sh-dot{animation:sh-blink 1.2s infinite}
.sh-avatar{transition:transform .2s,box-shadow .2s}
.sh-avatar:hover{transform:scale(1.18);box-shadow:0 8px 20px -6px rgba(0,0,0,.45)}
@media (prefers-reduced-motion:reduce){.sh-orbit,.sh-counter,.sh-pulse,.sh-dot,.sh-pop,.sh-fade,.sh-grow{animation:none}}
`;

export default function ShStyle() {
    return (
        <>
            <Head>
                <link rel="stylesheet" href="https://fonts.bunny.net/css?family=bricolage-grotesque:600,700,800&display=swap" />
            </Head>
            <style>{css}</style>
        </>
    );
}