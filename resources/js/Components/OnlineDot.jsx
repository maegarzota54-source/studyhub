import { useEffect, useState } from 'react';
export default function OnlineDot({ userId }) {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); window.addEventListener('presence', f); return () => window.removeEventListener('presence', f); }, []);
  const on = window.__online?.has(userId);
  return <span title={on ? 'Online' : 'Offline'} className={`inline-block h-2.5 w-2.5 rounded-full ${on ? 'bg-green-500' : 'bg-gray-300'}`} />;
}
