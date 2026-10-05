import { useEffect, useState } from 'react';
const QUOTES = ['Small groups make big goals happen.', 'Study together, grow together.', 'Consistency beats cramming.', 'Teach it to someone and you will know it.', 'Progress, not perfection.'];
/** Drop into Breeze's Pages/Auth/Login.jsx (and GuestLayout side panel). */
export default function QuoteRotator() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => (n + 1) % QUOTES.length), 6000); return () => clearInterval(t); }, []);
  return <blockquote aria-live="polite" className="text-2xl font-semibold text-white">“{QUOTES[i]}”</blockquote>;
}
