export function createSocket(url: string) {
  let ws: WebSocket | null = null;
  let messageHandler: ((msg: Record<string, unknown>) => void) | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    try {
      ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log("[ws] connected");
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          try {
            const msg = JSON.parse(event.data) as Record<string, unknown>;
            messageHandler?.(msg);
          } catch (e) {
            console.error("[ws] bad JSON", e);
          }
        }
      };

      ws.onclose = () => {
        console.log("[ws] disconnected, reconnecting in 2s...");
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = (e) => {
        console.error("[ws] error", e);
      };
    } catch (e) {
      console.error("[ws] connect failed", e);
      reconnectTimer = setTimeout(connect, 2000);
    }
  }

  connect();

  return {
    send(msg: Record<string, unknown>) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      } else {
        console.warn("[ws] not connected, dropping message", msg);
      }
    },
    onMessage(handler: (msg: Record<string, unknown>) => void) {
      messageHandler = handler;
    },
  };
}
