/**
 * useWebSocket.js — React hook for WebSocket events
 */
import { useEffect, useRef, useCallback } from 'react';
import { wsManager } from '../api.js';

export function useWebSocket(eventType, handler, deps = []) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const cb = (data) => handlerRef.current(data);
    const unsub = wsManager.on(eventType, cb);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, ...deps]);
}

export function useSendWS() {
  return useCallback((cmd, value) => wsManager.send(cmd, value), []);
}