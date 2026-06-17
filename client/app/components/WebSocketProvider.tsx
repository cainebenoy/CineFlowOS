"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { mutate } from "swr";

interface WebSocketContextType {
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({ isConnected: false });

export function WebSocketProvider({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId: string;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("cineflow_token");
    if (!token || !projectId) return;

    // Connect to the WebSocket Hub
    const wsUrl = `ws://localhost:8080/api/ws?token=${token}&projectId=${projectId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`[WebSocket] Connected to project room: ${projectId}`);
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[WebSocket] Event received:", data);

        // Map events to cache invalidations
        if (data.type === "TAKE_LOGGED") {
          console.log("[WebSocket] Invalidating SWR cache for takes...");
          // We trigger a silent background re-fetch for the Continuity timeline
          mutate(`http://localhost:8080/api/projects/${projectId}/takes`);
          // We can also trigger a re-fetch for the DPR since a new take affects the daily count
          mutate(`http://localhost:8080/api/projects/${projectId}/dpr`);
        }
      } catch (err) {
        console.error("[WebSocket] Failed to parse message:", err);
      }
    };

    ws.onclose = () => {
      console.log(`[WebSocket] Disconnected from project room: ${projectId}`);
      setIsConnected(false);
    };

    wsRef.current = ws;

    // Cleanup on unmount or projectId change
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [projectId]);

  return (
    <WebSocketContext.Provider value={{ isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => useContext(WebSocketContext);
