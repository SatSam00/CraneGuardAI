import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('connecting');
  const ws = useRef(null);
  const latestPayloadRef = useRef(null);
  const rafRef = useRef(null);
  const host = window.location.hostname || '127.0.0.1';
  const url = `ws://${host}:8200/ws/feed`;

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WS Connected');
        setStatus('connected');
      };

      ws.current.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        latestPayloadRef.current = payload;
        if (rafRef.current !== null) return;
        rafRef.current = window.requestAnimationFrame(() => {
          setData(latestPayloadRef.current);
          rafRef.current = null;
        });
      };

      ws.current.onclose = () => {
        console.log('WS Disconnected');
        setStatus('disconnected');
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      ws.current.onerror = (err) => {
        console.error('WS Error', err);
        setStatus('error');
        ws.current.close();
      };
    };

    connect();

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (ws.current) {
        ws.current.onclose = null; // Prevent reconnect on unmount
        ws.current.close();
      }
    };
  }, [url]);

  return (
    <WebSocketContext.Provider value={{ data, status }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketData = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketData must be used within a WebSocketProvider');
  }
  return context;
};
