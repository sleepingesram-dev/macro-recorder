import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sheet, Spinner } from './ui';
import { lookupBarcode } from '../api/foods';

// Barcode scanner: native BarcodeDetector where available, ZXing fallback.
// Camera needs a secure context (https or localhost). Manual entry always works.
export default function Scanner({ open, onClose, onFound, onNotFound }) {
  const videoRef = useRef(null);
  const stopRef = useRef(() => {});
  const [status, setStatus] = useState('starting'); // starting | scanning | looking-up | error | insecure
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const trackRef = useRef(null);
  const handledRef = useRef(false);

  const handleCode = useCallback(
    async (code) => {
      if (handledRef.current) return;
      handledRef.current = true;
      setStatus('looking-up');
      try {
        const food = await lookupBarcode(code);
        if (food) onFound({ ...food, viaScan: true });
        else onNotFound(code);
      } catch (e) {
        setError(`Lookup failed: ${e.message}. Check your connection, or add the food manually.`);
        setStatus('error');
        handledRef.current = false;
        return;
      }
      onClose();
    },
    [onFound, onNotFound, onClose]
  );

  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
    setStatus('starting');
    setError('');
    let cancelled = false;

    async function start() {
      if (!window.isSecureContext) {
        setStatus('insecure');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setError('Camera API unavailable in this browser. Use manual entry below.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        trackRef.current = stream.getVideoTracks()[0];
        setStatus('scanning');

        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
          });
          const tick = async () => {
            if (cancelled || handledRef.current) return;
            try {
              const codes = await detector.detect(video);
              if (codes.length > 0) return handleCode(codes[0].rawValue);
            } catch {
              /* frame not ready — keep going */
            }
            requestAnimationFrame(() => setTimeout(tick, 120));
          };
          tick();
          stopRef.current = () => stream.getTracks().forEach((t) => t.stop());
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
          ]);
          const reader = new BrowserMultiFormatReader(hints);
          const controls = await reader.decodeFromVideoElement(video, (result) => {
            if (result && !cancelled) handleCode(result.getText());
          });
          stopRef.current = () => {
            controls.stop();
            stream.getTracks().forEach((t) => t.stop());
          };
        }
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError(
          e.name === 'NotAllowedError'
            ? 'Camera permission denied. Grant access or use manual entry below.'
            : `Camera error: ${e.message}`
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      stopRef.current();
      stopRef.current = () => {};
      trackRef.current = null;
    };
  }, [open, handleCode]);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((t) => !t);
    } catch {
      setError('Torch not supported on this camera.');
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Scan Barcode">
      <div className="space-y-4">
        {status !== 'insecure' && (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {/* targeting frame */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-24 relative">
                {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((pos) => (
                  <div key={pos} className={`absolute w-6 h-6 border-gold ${pos}`} />
                ))}
                {status === 'scanning' && (
                  <motion.div
                    className="absolute inset-x-2 h-0.5 bg-gold/70 shadow-glow"
                    animate={{ top: ['15%', '85%', '15%'] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                  />
                )}
              </div>
            </div>
            {status === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Spinner label="Starting camera…" />
              </div>
            )}
            {status === 'looking-up' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Spinner label="Looking up…" />
              </div>
            )}
            <button
              onClick={toggleTorch}
              className={`absolute top-2 right-2 rounded-full p-2 text-lg border ${
                torchOn ? 'bg-gold/30 border-gold text-gold-bright' : 'bg-black/50 border-rune text-ink-2'
              }`}
              aria-label="Toggle torch"
            >
              ☀
            </button>
          </div>
        )}

        {status === 'insecure' && (
          <p className="text-xs text-ember-bright bg-ember/10 border border-ember/30 rounded-lg p-3">
            The camera requires a secure origin (https or localhost). Open the app via localhost or
            enter the barcode digits manually below.
          </p>
        )}
        {error && <p className="text-xs text-ember-bright">{error}</p>}

        <div>
          <p className="label">Manual entry</p>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              inputMode="numeric"
              placeholder="Barcode digits (UPC/EAN)"
              value={manual}
              onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && manual.length >= 8 && handleCode(manual)}
            />
            <button className="btn-gold" disabled={manual.length < 8} onClick={() => handleCode(manual)}>
              Look up
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
