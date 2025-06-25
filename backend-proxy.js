
require('dotenv').config();

// backend-proxy.js
const WebSocket = require('ws');
const http = require('http');


const API_KEY = process.env.OPENAI_API_KEY;


// *** NAJWAŻNIEJSZA ZMIANA - URL ZGODNY Z NOWĄ DOKUMENTACJĄ ***
// Dodajemy wszystkie parametry wejścia i wyjścia jako query params.
const params = new URLSearchParams({
  model: 'gpt-4o-realtime-preview',
  input_format: 'pcm',
  input_encoding: 's16le',
  input_sample_rate: '24000',
  output_format: 'pcm',
  output_encoding: 's16le',
  output_sample_rate: '24000',
  // Można też dodać inne parametry, np. 'voice': 'alloy'
});

const OPENAI_WS_URL = `wss://api.openai.com/v1/realtime?${params.toString()}`;

const server = http.createServer();
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (clientWs) => {
  console.log('[Proxy] Klient połączony.');

  // Nie potrzebujemy już buforowania na backendzie, bo pierwsza wiadomość od klienta to już audio.
  const openaiWs = new WebSocket(OPENAI_WS_URL, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  openaiWs.on('open', () => {
    console.log('[OpenAI WS] Połączono z OpenAI. Gotowy na dane.');
  });

  // Przekazywanie wiadomości od klienta do OpenAI
  clientWs.on('message', (msg) => {
    if (openaiWs.readyState === WebSocket.OPEN) {
      // Przyjmujemy, że od klienta przychodzi już tylko audio
      openaiWs.send(msg);
    }
  });

  // Przekazywanie wiadomości od OpenAI do klienta
  openaiWs.on('message', (msg, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(msg, { binary: isBinary });
    }
  });
  
  // Zarządzanie zamykaniem
  const closeConnections = () => {
    if (openaiWs.readyState !== WebSocket.CLOSED) openaiWs.close();
    if (clientWs.readyState !== WebSocket.CLOSED) clientWs.close();
  }
  clientWs.on('close', closeConnections);
  openaiWs.on('close', closeConnections);
  openaiWs.on('error', closeConnections);
  clientWs.on('error', closeConnections);
});

server.listen(3001, () => {
  console.log('Proxy WebSocket server listening on ws://localhost:3001/ws');
});