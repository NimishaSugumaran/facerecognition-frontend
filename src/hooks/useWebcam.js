/**
 * useWebcam.js — Webcam stream hook
 */
import { useRef, useState, useCallback, useEffect } from 'react';

export function useWebcam() {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [error,    setError]    = useState(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsActive(true);
      }
    } catch (e) {
      setError(`Camera error: ${e.message}`);
      setIsActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
  }, []);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !isActive) return null;
    const v = videoRef.current;
    const c = document.createElement('canvas');
    c.width  = v.videoWidth  || 640;
    c.height = v.videoHeight || 480;
    const ctx = c.getContext('2d');
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  }, [isActive]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return { videoRef, isActive, error, startCamera, stopCamera, captureFrame };
}