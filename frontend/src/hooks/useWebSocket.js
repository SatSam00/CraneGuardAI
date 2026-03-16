import { useState, useEffect, useRef } from 'react';

export const useWebSocket = (url) => {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('connecting');
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      console.log('WS Connected');
      setStatus('connected');
    };

    ws.current.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setData(payload);
    };

    ws.current.onclose = () => {
      console.log('WS Disconnected');
      setStatus('disconnected');
    };

    ws.current.onerror = (err) => {
      console.error('WS Error', err);
      setStatus('error');
    };

    return () => {
      ws.current.close();
    };
  }, [url]);

  return { data, status };
};
