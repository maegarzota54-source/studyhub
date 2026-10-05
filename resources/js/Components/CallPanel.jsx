import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { Btn } from '@/Layouts/AppLayout';

/**
 * 1-on-1 and group (mesh) calls. Each user's PeerJS id is "studyhub-user-{id}".
 * `targets` = user ids to ring when "Start call" is pressed (everyone online in the circle, or the one DM peer).
 * Mesh works well up to ~6 people; use an SFU (LiveKit etc.) beyond that.
 */
export default function CallPanel({ meId, targets }) {
  const peerRef = useRef(null), localRef = useRef(null), streamRef = useRef(null);
  const [remotes, setRemotes] = useState({});          // peerId -> MediaStream
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false), [camOff, setCamOff] = useState(false);
  const calls = useRef({});

  const media = async (video = true) => {
    if (!streamRef.current) {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      if (localRef.current) localRef.current.srcObject = streamRef.current;
    }
    return streamRef.current;
  };
  const attach = (call) => {
    calls.current[call.peer] = call;
    call.on('stream', (s) => setRemotes((r) => ({ ...r, [call.peer]: s })));
    call.on('close', () => setRemotes((r) => { const { [call.peer]: _, ...rest } = r; return rest; }));
  };

  useEffect(() => {
    const peer = new Peer(`studyhub-user-${meId}`);   // add { host, port, config:{iceServers:[TURN]} } for production
    peerRef.current = peer;
    peer.on('call', async (call) => {
      if (!window.confirm('Incoming study call. Answer?')) return call.close();
      call.answer(await media()); attach(call); setInCall(true);
    });
    return () => { end(); peer.destroy(); };
  }, [meId]);

  const start = async () => {
    const stream = await media(); setInCall(true);
    targets.forEach((id) => attach(peerRef.current.call(`studyhub-user-${id}`, stream)));
  };
  function end() {
    Object.values(calls.current).forEach((c) => c.close()); calls.current = {};
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null;
    setRemotes({}); setInCall(false);
  }
  const toggle = (kind, state, set) => { streamRef.current?.getTracks().filter((t) => t.kind === kind).forEach((t) => (t.enabled = state)); set(!state); };

  return (
    <div className="rounded-xl bg-slate-900 p-3 text-white">
      {!inCall ? (
        <Btn variant="accent" onClick={start} disabled={!targets.length}><Phone className="mr-1 inline" size={16} /> Start call</Btn>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <video ref={localRef} autoPlay muted playsInline className="aspect-video rounded-lg bg-black" />
            {Object.entries(remotes).map(([id, s]) => <video key={id} autoPlay playsInline className="aspect-video rounded-lg bg-black" ref={(el) => el && (el.srcObject = s)} />)}
          </div>
          <div className="mt-2 flex gap-2">
            <Btn variant="ghost" className="text-white" onClick={() => toggle('audio', muted, setMuted)}>{muted ? <MicOff size={16} /> : <Mic size={16} />}</Btn>
            <Btn variant="ghost" className="text-white" onClick={() => toggle('video', camOff, setCamOff)}>{camOff ? <VideoOff size={16} /> : <Video size={16} />}</Btn>
            <Btn variant="accent" onClick={end}><PhoneOff size={16} /></Btn>
          </div>
        </>
      )}
    </div>
  );
}
