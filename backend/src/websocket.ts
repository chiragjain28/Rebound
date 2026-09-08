import { Server } from 'http';
import WebSocket, { Server as WebSocketServer } from 'ws';

let wss: WebSocketServer;

export const initWebSocket = (server: Server) => {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
};

export const broadcast = (data: any) => {
  if (!wss) return;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};
