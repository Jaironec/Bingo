const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const compression = require('compression');
const pino = require('pino');
const Sentry = require('@sentry/node');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Seguridad y CORS
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
  app.use(Sentry.Handlers.requestHandler());
}
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Servir un favicon básico si el navegador solicita .ico y no existe uno
app.get('/favicon.ico', (req, res) => {
  res.redirect(302, '/favicon.svg');
});
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Estructura de datos para manejar las salas
const salas = new Map();
const tokens = new Map(); // sessionToken -> { salaId, jugadorId }
const baneadosPorSala = new Map(); // salaId -> Set(sessionToken)
const bingoThrottle = new Map(); // socket.id -> lastTs
const BINGO_THROTTLE_MS = parseInt(process.env.BINGO_THROTTLE_MS || '1500', 10);

// Generar código de sala de 4 dígitos
function generarCodigoSala() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Generador de tablas de bingo
function generarTablaBingo() {
const tabla = [];
const numeros = new Set();
  
// Generar números únicos para cada columna
for (let col = 0; col < 5; col++) {
  const columna = [];
  const min = col * 15 + 1;
  const max = (col + 1) * 15;
  
  while (columna.length < 5) {
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!numeros.has(num)) {
      numeros.add(num);
      columna.push(num);
    }
  }
  tabla.push(columna);
}
  
// Transponer la matriz para obtener las filas con letras B-I-N-G-O
const filas = [];
const letras = ['B', 'I', 'N', 'G', 'O'];
  
for (let i = 0; i < 5; i++) {
  const fila = [];
  for (let j = 0; j < 5; j++) {
    const numero = tabla[j][i];
    const letra = letras[j];
    fila.push({
      numero: numero,
      letra: letra,
      numeroConLetra: `${letra}${numero}`
    });
  }
  filas.push(fila);
}
  
// Marcar centro libre (FREE)
if (filas[2] && filas[2][2]) {
  filas[2][2] = {
    numero: 0,
    letra: 'FREE',
    numeroConLetra: 'FREE',
    esLibre: true
  };
}
  
return filas;
}

// Generar 21 tablas únicas
function generarTablasUnicas() {
  const tablas = [];
  const tablasSet = new Set();
  
  while (tablas.length < 21) {
    const tabla = generarTablaBingo();
    const tablaString = JSON.stringify(tabla);
    
    if (!tablasSet.has(tablaString)) {
      tablasSet.add(tablaString);
      tablas.push({
        id: tablas.length,
        numeros: tabla,
        disponible: true
      });
    }
  }
  
  return tablas;
}

function sanearNombre(nombre) {
  try {
    if (!nombre) return 'Jugador';
    let s = String(nombre).trim();
    s = s.replace(/[^\p{L}\p{N}\s._-]/gu, '');
    if (s.length === 0) s = 'Jugador';
    return s.substring(0, 20);
  } catch {
    return 'Jugador';
  }
}