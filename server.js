const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Servir un favicon básico si el navegador solicita .ico y no existe uno
app.get('/favicon.ico', (req, res) => {
  res.redirect(302, '/favicon.svg');
});

// Estructura de datos para manejar las salas
const salas = new Map();

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

// Generar 20 tablas únicas
function generarTablasUnicas() {
  const tablas = [];
  const tablasSet = new Set();
  
  while (tablas.length < 20) {
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

// Verificar patrones de bingo
function verificarBingo(tabla, numerosMarcados, patron, numeroUltimo) {
  const numerosSet = new Set(numerosMarcados);
  const incluyeUltimo = (fila, col) => {
    try { return tabla[fila][col].numero === numeroUltimo; } catch { return false; }
  };
  const isMarked = (celda) => !!(celda && (numerosSet.has(celda.numero) || celda.esLibre === true));
  
  switch (patron) {
    case 'tablaLlena':
      if (tabla.every(fila => fila.every(celda => isMarked(celda))) &&
          tabla.some(fila => fila.some(celda => celda.numero === numeroUltimo))) {
        return { ganado: true, tipo: 'tabla llena' };
      }
      break;
    case 'cuatroEsquinas':
      const corners = [tabla[0][0], tabla[0][4], tabla[4][0], tabla[4][4]];
      const completas = corners.every(isMarked);
      const ultimoEnCorners = corners.some(c => c.numero === numeroUltimo);
      if (completas && ultimoEnCorners) {
        return { ganado: true, tipo: 'cuatro esquinas' };
      }
      break;
    case 'machetaso':
      const diagPCompleta = [0,1,2,3,4].every(i => isMarked(tabla[i][i]));
      const diagSCompleta = [0,1,2,3,4].every(i => isMarked(tabla[i][4 - i]));
      const ultimoEnDiagP = [0,1,2,3,4].some(i => tabla[i][i].numero === numeroUltimo);
      const ultimoEnDiagS = [0,1,2,3,4].some(i => tabla[i][4 - i].numero === numeroUltimo);
      if (diagPCompleta && ultimoEnDiagP) {
        return { ganado: true, tipo: 'machetaso (diagonal central)', diagonal: 'principal' };
      }
      if (diagSCompleta && ultimoEnDiagS) {
        return { ganado: true, tipo: 'machetaso (diagonal central)', diagonal: 'secundaria' };
      }
      break;
    case 'loco':
      if (numerosMarcados.filter(n => n!==0).length === 5 && numerosSet.has(numeroUltimo)) {
        return { ganado: true, tipo: 'LOCO (5 números)' };
      }
      break;
    case 'linea':
      for (let col = 0; col < 5; col++) {
        const completa = tabla.every(fila => isMarked(fila[col]));
        if (completa && tabla.some((_, f) => incluyeUltimo(f, col))) {
          return { ganado: true, tipo: 'línea vertical', columna: col + 1 };
        }
      }
      for (let fila = 0; fila < 5; fila++) {
        const completa = tabla[fila].every(celda => isMarked(celda));
        if (completa && tabla[fila].some(celda => celda.numero === numeroUltimo)) {
          return { ganado: true, tipo: 'línea horizontal', fila: fila + 1 };
        }
      }
      break;
  }
  
  return { ganado: false };
}

// NUEVO ENFOQUE: Detectar TODOS los patrones ganados y clasificar inteligentemente
function resolverTiebreak(salaId) {
  const sala = salas.get(salaId);
  if (!sala || !sala._tiebreak) return;
  
  sala._tiebreak.activo = false;
  const numero = sala._tiebreak.numero;
  const participantes = sala._tiebreak.participantes || [];
  clearTimeout(sala._tiebreak.timeout);

  console.log(`🎲 Resolviendo tiebreak para número ${numero} con ${participantes.length} participantes`);

  // PASO 1: Detectar TODOS los patrones ganados por cada participante
  const todosLosPatrones = detectarTodosLosPatronesGanados(sala, numero, participantes);
  
  // PASO 2: Clasificar ganadores únicos vs empates reales
  const { ganadoresUnicos, empatesReales } = clasificarResultados(todosLosPatrones, numero);
  
  console.log(`🎯 Ganadores únicos: ${ganadoresUnicos.length}, Empates reales: ${empatesReales.length}`);

  // PASO 3: Otorgar patrones únicos INMEDIATAMENTE
  ganadoresUnicos.forEach(ganador => {
    const yaPatronGanado = sala.ganadores.some(g => 
      g.patron === ganador.patron && 
      g.jugador.id === ganador.jugador.id
    );
    
    if (!yaPatronGanado) {
      const record = {
        jugador: {
          id: ganador.jugador.id,
          nombre: ganador.jugador.nombre,
          tablaSeleccionada: ganador.jugador.tablaSeleccionada,
          numerosMarcados: ganador.jugador.numerosMarcados
        },
        patron: ganador.patron,
        resultado: ganador.resultado,
        numeroGanador: String(numero)
      };
      
      sala.ganadores.push(record);
      io.to(salaId).emit('bingoDeclarado', record);
      console.log(`🏆 ${ganador.jugador.nombre} ganó ${ganador.patron} (único)`);
    }
  });

  // PASO 4: Resolver empates con dados
  if (empatesReales.length > 0) {
    console.log(`🎲 Resolviendo ${empatesReales.length} empates con dados`);
    resolverEmpatesConDados(empatesReales, salaId, sala);
  } else {
    // No hay empates - reanudar inmediatamente
    console.log(`✅ No hay empates - reanudando juego inmediatamente`);
    reanudarJuegoSinEmpate(salaId, sala);
  }

  // Verificar si alguien ganó tabla llena
  const huboTablaLlena = sala.ganadores.some(g => g.patron === 'tablaLlena');
  if (huboTablaLlena) {
    sala.juegoActivo = false;
    
    // Emitir evento especial para tabla llena con todos los ganadores
    const todosLosGanadores = sala.ganadores.map(g => ({
      nombre: g.jugador.nombre,
      patron: g.patron,
      tipo: g.resultado.tipo,
      numeroGanador: g.numeroGanador
    }));
    
    io.to(salaId).emit('juegoTerminado', { 
      mensaje: '¡Tabla Llena! Fin del juego',
      ganadores: todosLosGanadores,
      esTablaLlena: true
    });
  }
}

// Función para detectar TODOS los patrones ganados
function detectarTodosLosPatronesGanados(sala, numero, participantes) {
  const patrones = sala.configuracion?.patrones || ['linea','tablaLlena','cuatroEsquinas','machetaso','loco'];
  const candidatosPorPatron = new Map();

  // Para cada participante, verificar TODOS los patrones disponibles
  participantes.forEach(p => {
    const jugador = sala.jugadores.find(j => j.id === p.id);
    if (!jugador || !jugador.tablaSeleccionada) return;
    
    // Filtrar números válidos (que estén en la tabla del jugador)
    const numerosValidos = (jugador.numerosMarcados || []).filter(n => 
      jugador.tablaSeleccionada.numeros.some(f => f.some(c => c.numero === n))
    );
    
    // Verificar cada patrón disponible
    patrones.forEach(patron => {
      const resultado = verificarBingo(
        jugador.tablaSeleccionada.numeros, 
        numerosValidos, 
        patron, 
        numero
      );
      
      if (resultado.ganado) {
        if (!candidatosPorPatron.has(patron)) {
          candidatosPorPatron.set(patron, []);
        }
        candidatosPorPatron.get(patron).push({
          jugador,
          patron,
          resultado
        });
      }
    });
  });

  return candidatosPorPatron;
}

// Función para clasificar ganadores únicos vs empates
function clasificarResultados(candidatosPorPatron, numero) {
  const ganadoresUnicos = [];
  const empatesReales = [];

  candidatosPorPatron.forEach((jugadores, patron) => {
    if (jugadores.length === 1) {
      // GANADOR ÚNICO - No necesita tiebreak
      ganadoresUnicos.push({
        ...jugadores[0],
        numeroGanador: String(numero)
      });
    } else if (jugadores.length > 1) {
      // EMPATE REAL - Necesita tiebreak
      empatesReales.push({
        patron,
        jugadores,
        numeroGanador: String(numero)
      });
    }
  });

  return { ganadoresUnicos, empatesReales };
}

// Función para resolver empates con dados
function resolverEmpatesConDados(empatesReales, salaId, sala) {
  const winnersToEmit = [];
  
  empatesReales.forEach(empate => {
    console.log(`🎲 Resolviendo empate en ${empate.patron} entre ${empate.jugadores.length} jugadores`);
    
    // Lanzar DOS dados para cada jugador en este patrón
    const tiradas = empate.jugadores.map(j => {
      const dado1 = Math.floor(Math.random() * 6) + 1;
      const dado2 = Math.floor(Math.random() * 6) + 1;
      const total = dado1 + dado2; // Suma de dos dados (2-12)
      
      return {
        jugador: j.jugador,
        patron: empate.patron,
        resultado: j.resultado,
        dado1: dado1,
        dado2: dado2,
        total: total
      };
    });
    
    // Determinar ganador (con re-roll si es necesario)
    let max = Math.max(...tiradas.map(t => t.total));
    let top = tiradas.filter(t => t.total === max);
    let intentos = 0;
    
    while (top.length > 1 && intentos < 5) {
      top = top.map(t => {
        const dado1 = Math.floor(Math.random() * 6) + 1;
        const dado2 = Math.floor(Math.random() * 6) + 1;
        return { ...t, dado1, dado2, total: dado1 + dado2 };
      });
      max = Math.max(...top.map(t => t.total));
      top = top.filter(t => t.total === max);
      intentos++;
    }
    
    const ganador = top[0];
    
    // Emitir resultado del tiebreak con DOS dados
    io.to(salaId).emit('tiebreakResultado', {
      patron: empate.patron,
      numero: empate.numeroGanador,
      tiradas: tiradas.map(t => ({
        jugadorId: t.jugador.id,
        nombre: t.jugador.nombre,
        dado1: t.dado1,
        dado2: t.dado2,
        total: t.total
      })),
      ganador: {
        jugadorId: ganador.jugador.id,
        nombre: ganador.jugador.nombre,
        dado1: ganador.dado1,
        dado2: ganador.dado2,
        total: ganador.total
      }
    });
    
    // Agregar a la lista de ganadores
    winnersToEmit.push({
      jugador: ganador.jugador,
      patron: empate.patron,
      resultado: ganador.resultado,
      numeroGanador: empate.numeroGanador
    });
  });
  
  // Registrar ganadores del tiebreak
  winnersToEmit.forEach(ganador => {
    const yaPatronGanado = sala.ganadores.some(g => 
      g.patron === ganador.patron && 
      g.jugador.id === ganador.jugador.id
    );
    
    if (!yaPatronGanado) {
      const record = {
        jugador: {
          id: ganador.jugador.id,
          nombre: ganador.jugador.nombre,
          tablaSeleccionada: ganador.jugador.tablaSeleccionada,
          numerosMarcados: ganador.jugador.numerosMarcados
        },
        patron: ganador.patron,
        resultado: ganador.resultado,
        numeroGanador: ganador.numeroGanador
      };
      
      sala.ganadores.push(record);
      io.to(salaId).emit('bingoDeclarado', record);
      console.log(`🏆 ${ganador.jugador.nombre} ganó ${ganador.patron} (después de tiebreak)`);
    }
  });
  
  // Reanudar después de 5s para dar tiempo a ver el modal
  setTimeout(() => {
    if (!sala) return;
    sala.juegoActivo = true;
    io.to(salaId).emit('estadoJuego', { estado: 'reanudado', por: 'tiebreak' });
    io.to(salaId).emit('juegoReanudado', { mensaje: '¡El juego continúa!' });
  }, 5000);
}

// Función para reanudar sin empate
function reanudarJuegoSinEmpate(salaId, sala) {
  sala.juegoActivo = true;
  
  // Obtener información de los ganadores únicos para el mensaje detallado
  const ganadoresUnicos = [];
  sala.ganadores.forEach(ganador => {
    if (ganador.numeroGanador === sala._tiebreak.numero) {
      ganadoresUnicos.push({
        nombre: ganador.jugador.nombre,
        patron: ganador.patron,
        tipo: ganador.resultado.tipo
      });
    }
  });
  
  // Emitir evento especial para victoria sin empate con detalles
  io.to(salaId).emit('victoriaSinEmpate', { 
    mensaje: '¡Victoria confirmada! No hubo empate, el juego continúa.',
    ganadores: ganadoresUnicos,
    timestamp: Date.now()
  });
  
  // Reanudar el juego (sin notificación adicional para evitar spam)
  sala.juegoActivo = true;
}

// Manejo de conexiones Socket.IO
io.on('connection', (socket) => {
  // Declaración de bingo con botón único (ventana de espera y desempate)
  socket.on('declararBingoUnico', (data) => {
    const sala = salas.get(data.salaId);
    if (!sala) return;
    const ultimoNumeroCantado = sala.numerosCantados[sala.numerosCantados.length - 1];
    // Evitar reclamos tardíos una vez resuelta la ventana para este número
    if (sala._tiebreakResueltoParaNumero && Number(sala._tiebreakResueltoParaNumero) === Number(ultimoNumeroCantado)) {
      socket.emit('error', { mensaje: 'La ventana de Bingo para este número ya terminó' });
      return;
    }
      // Pausar juego mientras se espera a otros posibles ganadores
  // NO emitir estadoJuego aquí para evitar mensajes en el historial
  sala.juegoActivo = false;
  const anfitrion = sala.jugadores.find(j => j.id === sala.anfitrion);
    if (sala._tiebreak && sala._tiebreak.activo) {
      // agregar participante si no está
      const existe = sala._tiebreak.participantes.some(p => p.id === socket.id);
      if (!existe) sala._tiebreak.participantes.push({ id: socket.id });
      return;
    }

    // abrir ventana de 3s para recolectar clics simultáneos
    sala._tiebreak = {
      activo: true,
      inicio: Date.now(),
      numero: ultimoNumeroCantado,
      participantes: [{ id: socket.id }],
      timeout: setTimeout(() => resolverTiebreak(sala.id), 3000)
    };
    io.to(data.salaId).emit('tiebreakIniciado', { ventanaMs: 3000, numero: ultimoNumeroCantado });
  });
  console.log('Usuario conectado:', socket.id);
  
  // Crear nueva sala
  socket.on('crearSala', (data) => {
    const salaId = generarCodigoSala();
    const tablas = generarTablasUnicas();
    
    const sala = {
      id: salaId,
      anfitrion: socket.id,
      jugadores: [],
      tablas: tablas,
      numerosCantados: [],
      juegoActivo: false,
      configuracion: {
        patrones: data.patrones || ['linea', 'tablaLlena', 'cuatroEsquinas'],
        velocidadCanto: data.velocidadCanto || 3000
      },
      ganadores: [],
      _ultimaActividad: Date.now() // Para persistencia breve
    };
    
    // Agregar al anfitrión como jugador también
    const anfitrionJugador = {
      id: socket.id,
      nombre: data.nombreAnfitrion || 'Anfitrión',
      tablaSeleccionada: null,
      numerosMarcados: [],
      esAnfitrion: true
    };
    
    sala.jugadores.push(anfitrionJugador);
    salas.set(salaId, sala);
    socket.join(salaId);
    
    socket.emit('salaCreada', { salaId, sala, jugador: anfitrionJugador });
    console.log(`Sala creada: ${salaId} por ${data.nombreAnfitrion || 'Anfitrión'}`);
  });
  
  // Unirse a sala
  socket.on('unirseSala', (data) => {
    const sala = salas.get(data.salaId);
    
    if (!sala) {
      socket.emit('error', { mensaje: 'Sala no encontrada' });
      return;
    }
    
    if (sala.jugadores.length >= 20) {
      socket.emit('error', { mensaje: 'Sala llena' });
      return;
    }
    
    if (sala.juegoActivo) {
      socket.emit('error', { mensaje: 'El juego ya está en progreso' });
      return;
    }
    
    const jugador = {
      id: socket.id,
      nombre: data.nombre,
      tablaSeleccionada: null,
      numerosMarcados: [],
      esAnfitrion: false
    };
    
    sala.jugadores.push(jugador);
    socket.join(data.salaId);
    
    socket.emit('unidoSala', { sala, jugador });
    socket.to(data.salaId).emit('jugadorUnido', jugador);
    
    console.log(`Jugador ${data.nombre} se unió a la sala ${data.salaId}`);
  });
  
  // Seleccionar tabla
  socket.on('seleccionarTabla', (data) => {
    const sala = salas.get(data.salaId);
    if (!sala) return;
    
    const jugador = sala.jugadores.find(j => j.id === socket.id);
    if (!jugador) return;
    
    const nuevaTabla = sala.tablas.find(t => t.id === data.tablaId);
    if (!nuevaTabla) {
      socket.emit('error', { mensaje: 'Tabla no encontrada' });
      return;
    }

    // Si intenta seleccionar la misma tabla, solo confirmar
    if (jugador.tablaSeleccionada && jugador.tablaSeleccionada.id === nuevaTabla.id) {
      socket.emit('tablaSeleccionada', { tabla: jugador.tablaSeleccionada });
      return;
    }
    
    if (!nuevaTabla.disponible) {
      socket.emit('error', { mensaje: 'Tabla no disponible' });
      return;
    }
    
    // Liberar tabla anterior del jugador si existía
    if (jugador.tablaSeleccionada) {
      const anterior = sala.tablas.find(t => t.id === jugador.tablaSeleccionada.id);
      if (anterior) {
        anterior.disponible = true;
        io.to(data.salaId).emit('tablaLiberada', { tablaId: anterior.id });
      }
    }
    
    // Asignar nueva tabla
    nuevaTabla.disponible = false;
    jugador.tablaSeleccionada = nuevaTabla;
    
    // Confirmar al jugador su selección
    socket.emit('tablaSeleccionada', { tabla: nuevaTabla });
    
    // Notificar a los demás sobre el estado de la tabla y del jugador
    socket.to(data.salaId).emit('tablaOcupada', { tablaId: data.tablaId });
    io.to(data.salaId).emit('jugadorSeleccionoTabla', { jugadorId: jugador.id, tabla: nuevaTabla });
    
    console.log(`Jugador ${jugador.nombre} seleccionó tabla ${data.tablaId}`);
  });
  
  // Iniciar juego (solo anfitrión)
  socket.on('iniciarJuego', (data) => {
    const sala = salas.get(data.salaId);
    if (!sala || sala.anfitrion !== socket.id) return;
    
    sala.juegoActivo = true;
    sala.numerosCantados = [];
    sala.ganadores = [];
    
    // Limpiar solo los números marcados, NO las tablas seleccionadas
    sala.jugadores.forEach(jugador => {
      jugador.numerosMarcados = [];
    });
    
    // Enviar el evento de juego iniciado a todos
    io.to(data.salaId).emit('juegoIniciado', { sala });
    
    // Enviar la tabla seleccionada a cada jugador individualmente
    sala.jugadores.forEach(jugador => {
      if (jugador.tablaSeleccionada) {
        io.to(jugador.id).emit('tablaSeleccionada', { tabla: jugador.tablaSeleccionada });
      }
    });
    
    // Iniciar canto automático
    iniciarCantoAutomatico(data.salaId);
    
    console.log(`Juego iniciado en sala ${data.salaId}`);
  });
  
  // Marcar número
  socket.on('marcarNumero', (data) => {
    const sala = salas.get(data.salaId);
    if (!sala) return;
    sala._ultimaActividad = Date.now();
    
    const jugador = sala.jugadores.find(j => j.id === socket.id);
    if (!jugador || !jugador.tablaSeleccionada) return;
    
    // Verificar que el número esté en la tabla del jugador
    const numeroEnTabla = jugador.tablaSeleccionada.numeros.some(fila => 
      fila.some(celda => celda.numero === data.numero)
    );
    
    if (!numeroEnTabla) {
      console.log(`Intento de marcar número ${data.numero} que no está en la tabla de ${jugador.nombre}`);
      return;
    }
    
    // Verificar que el número esté cantado
    if (!sala.numerosCantados.includes(data.numero)) {
      console.log(`Intento de marcar número ${data.numero} que no ha sido cantado`);
      return;
    }
    
    // Verificar que no esté ya marcado
    if (!jugador.numerosMarcados.includes(data.numero)) {
      jugador.numerosMarcados.push(data.numero);
      console.log(`${jugador.nombre} marcó el número ${data.numero}`);
    }
    
    socket.emit('numeroMarcado', { numero: data.numero });
  });
  
  // Declarar bingo (legacy por patrón; UI usa botón único)
  socket.on('declararBingo', (data) => {
    const sala = salas.get(data.salaId);
    if (!sala) return;
    // Permitir declarar durante la pausa si es con el mismo último número, pero bloquear si ya terminó por tabla llena
    const yaTerminoPorTablaLlena = sala.ganadores.some(g => g.patron === 'tablaLlena');
    if (yaTerminoPorTablaLlena) {
      socket.emit('error', { mensaje: 'El juego ya terminó por Tabla Llena' });
      return;
    }
    sala._ultimaActividad = Date.now();
    
    const jugador = sala.jugadores.find(j => j.id === socket.id);
    if (!jugador || !jugador.tablaSeleccionada) return;
    
    // Verificar que este patrón no haya sido ganado ya
    const ultimoNumeroCantado = sala.numerosCantados[sala.numerosCantados.length - 1];
    const huboGanadorPrevioMismoPatron = sala.ganadores.some(g => g.patron === data.patron && Number(g.numeroGanador) !== Number(ultimoNumeroCantado));
    const jugadorYaGanoEstePatron = sala.ganadores.some(g => g.patron === data.patron && g.jugador.id === socket.id);
    if (huboGanadorPrevioMismoPatron || jugadorYaGanoEstePatron) {
      console.log(`Patrón ${data.patron} ya fue ganado antes o por este jugador`);
      socket.emit('error', { mensaje: `El patrón ${data.patron} ya fue ganado anteriormente` });
      return;
    }
    
    // Reglas: debes haber marcado el último número cantado y el patrón debe incluirlo
    if (!jugador.numerosMarcados.includes(ultimoNumeroCantado)) {
      console.log(`❌ Bingo inválido: no has marcado el último número cantado (${ultimoNumeroCantado})`);
      socket.emit('error', { mensaje: 'Bingo inválido: debes haber marcado el último número cantado' });
      return;
    }
    
    console.log(`✅ Validación de tiempo exitosa`);
    
    // Filtrar solo los números marcados que estén en la tabla del jugador
    const numerosValidos = jugador.numerosMarcados.filter(numero => {
      return jugador.tablaSeleccionada.numeros.some(fila => 
        fila.some(celda => celda.numero === numero)
      );
    });
    
    const resultado = verificarBingo(
      jugador.tablaSeleccionada.numeros,
      numerosValidos,
      data.patron,
      ultimoNumeroCantado
    );
    
    if (resultado.ganado) {
      // Ganador principal (patrón declarado)
      const winnersToEmit = [];
      const ganador = {
        jugador: {
          id: jugador.id,
          nombre: jugador.nombre,
          tablaSeleccionada: jugador.tablaSeleccionada,
          numerosMarcados: numerosValidos
        },
        patron: data.patron,
        resultado: resultado,
        numeroGanador: data.numeroGanador
      };
      sala.ganadores.push(ganador);
      winnersToEmit.push(ganador);

      // Auto-otorgar otros patrones válidos con el mismo último número para este jugador
      const otrosPatrones = (sala.configuracion?.patrones || []).filter(p => p !== data.patron);
      for (const p of otrosPatrones) {
        const huboGanadorPrevioMismoPatronX = sala.ganadores.some(g => g.patron === p && Number(g.numeroGanador) !== Number(ultimoNumeroCantado));
        const jugadorYaGanoEstePatronX = sala.ganadores.some(g => g.patron === p && g.jugador.id === socket.id);
        if (huboGanadorPrevioMismoPatronX || jugadorYaGanoEstePatronX) continue;
        const resX = verificarBingo(
          jugador.tablaSeleccionada.numeros,
          numerosValidos,
          p,
          ultimoNumeroCantado
        );
        if (resX.ganado) {
          const ganadorX = {
            jugador: {
              id: jugador.id,
              nombre: jugador.nombre,
              tablaSeleccionada: jugador.tablaSeleccionada,
              numerosMarcados: numerosValidos
            },
            patron: p,
            resultado: resX,
            numeroGanador: data.numeroGanador
          };
          sala.ganadores.push(ganadorX);
          winnersToEmit.push(ganadorX);
        }
      }

      // Emitir todos los ganadores detectados en esta declaración
      let huboTablaLlena = false;
      for (const w of winnersToEmit) {
        io.to(data.salaId).emit('bingoDeclarado', w);
        if (w.patron === 'tablaLlena') huboTablaLlena = true;
      }

      // Control de pausa/reanudación o fin de juego
      if (huboTablaLlena) {
        sala.juegoActivo = false; // Detener el juego permanentemente
        io.to(data.salaId).emit('juegoTerminado', { mensaje: `¡${jugador.nombre} ganó con ${resultado.tipo}!` });
      } else {
        // Pausa temporal única
        sala.juegoActivo = false;
        setTimeout(() => {
          // Si alguien hizo tabla llena en esta ventana, no reanudar
          const termino = sala.ganadores.some(g => g.patron === 'tablaLlena');
          if (!termino) {
            sala.juegoActivo = true;
            io.to(data.salaId).emit('juegoReanudado', { mensaje: '¡El juego continúa!' });
          }
        }, 5000);
      }
    } else {
      socket.emit('error', { mensaje: 'Bingo inválido' });
    }
  });
  
  // Configurar sala (solo anfitrión)
  socket.on('configurarSala', (data) => {
    const sala = salas.get(data.salaId);
    if (!sala || sala.anfitrion !== socket.id) return;
    
    sala.configuracion = { ...sala.configuracion, ...data.configuracion };
    io.to(data.salaId).emit('salaConfigurada', { configuracion: sala.configuracion });
  });

  // Pausar juego (solo anfitrión)
  socket.on('pausarJuego', (data) => {
    const sala = salas.get(data.salaId);
    if (!sala || sala.anfitrion !== socket.id) return;
    sala.juegoActivo = false;
    const anfitrion = sala.jugadores.find(j => j.id === socket.id);
    
    // Determinar el motivo de la pausa
    let motivo = 'anfitrión';
    if (data.motivo === 'empate') {
      motivo = 'empate';
    }
    
    io.to(data.salaId).emit('estadoJuego', { estado: 'pausa', por: motivo });
  });

  // Reanudar juego (solo anfitrión)
  socket.on('reanudarJuego', (data) => {
    const sala = salas.get(data.salaId);
    if (!sala || sala.anfitrion !== socket.id) return;
    sala.juegoActivo = true;
    const anfitrion = sala.jugadores.find(j => j.id === socket.id);
    
    // Determinar el motivo de la reanudación
    let motivo = 'anfitrión';
    if (data.motivo === 'tiebreak') {
      motivo = 'tiebreak';
    }
    
    io.to(data.salaId).emit('estadoJuego', { estado: 'reanudado', por: motivo });
  });
  
  // Desconexión
  socket.on('disconnect', () => {
    // Remover jugador de todas las salas
    salas.forEach((sala, salaId) => {
      const jugadorIndex = sala.jugadores.findIndex(j => j.id === socket.id);
      if (jugadorIndex !== -1) {
        const jugador = sala.jugadores[jugadorIndex];
        sala.jugadores.splice(jugadorIndex, 1);
        
        // Si era anfitrión, asignar nuevo anfitrión o cerrar sala
        if (sala.anfitrion === socket.id) {
          if (sala.jugadores.length > 0) {
            sala.anfitrion = sala.jugadores[0].id;
          } else {
            salas.delete(salaId);
          }
        }
        
        socket.to(salaId).emit('jugadorDesconectado', jugador);
      }
    });
  });
});

// Persistencia breve en memoria (limpieza por inactividad)
const EXPIRA_MS = 5 * 60 * 1000; // 5 minutos
setInterval(() => {
  const ahora = Date.now();
  salas.forEach((sala, id) => {
    if (!sala._ultimaActividad) sala._ultimaActividad = ahora;
    if (ahora - (sala._ultimaActividad || ahora) > EXPIRA_MS && !sala.juegoActivo) {
      salas.delete(id);
    }
  });
}, 60 * 1000);

// Función para obtener letra B-I-N-G-O según el número
function obtenerLetraBingo(numero) {
  if (numero >= 1 && numero <= 15) return 'B';
  if (numero >= 16 && numero <= 30) return 'I';
  if (numero >= 31 && numero <= 45) return 'N';
  if (numero >= 46 && numero <= 60) return 'G';
  if (numero >= 61 && numero <= 75) return 'O';
  return '';
}

// Función para canto automático
function iniciarCantoAutomatico(salaId) {
  const sala = salas.get(salaId);
  if (!sala) return;
  
  // Conjunto de números disponibles 1..75
  let numerosDisponibles = [];
  for (let i = 1; i <= 75; i++) numerosDisponibles.push(i);
  
  const intervalo = setInterval(() => {
    // Detener si ya hubo tabla llena
    const hayTablaLlena = sala.ganadores.some(g => g.patron === 'tablaLlena');
    if (hayTablaLlena) {
      clearInterval(intervalo);
      return;
    }
    
    // Pausa respetando el estado del juego
    if (!sala.juegoActivo) {
      return;
    }
    
    if (numerosDisponibles.length === 0) {
      clearInterval(intervalo);
      io.to(salaId).emit('juegoTerminado', { mensaje: 'Se cantaron todos los números' });
      return;
    }
    
    // Elegir un índice aleatorio de los disponibles y extraerlo
    const idx = Math.floor(Math.random() * numerosDisponibles.length);
    const numeroAleatorio = numerosDisponibles.splice(idx, 1)[0];
    const letraBingo = obtenerLetraBingo(numeroAleatorio);
    sala.numerosCantados.push(numeroAleatorio);
    
    io.to(salaId).emit('numeroCantado', { 
      numero: numeroAleatorio,
      letraBingo: letraBingo,
      numeroConLetra: `${letraBingo}${numeroAleatorio}`,
      numerosCantados: sala.numerosCantados 
    });
    
  }, sala.configuracion.velocidadCanto);
}

// Rutas API
app.get('/api/salas', (req, res) => {
  const salasInfo = Array.from(salas.values()).map(sala => ({
    id: sala.id,
    jugadores: sala.jugadores.length,
    juegoActivo: sala.juegoActivo
  }));
  res.json(salasInfo);
});

app.get('/api/sala/:id', (req, res) => {
  const sala = salas.get(req.params.id);
  if (!sala) return res.status(404).json({ error: 'Sala no encontrada' });
  res.json(sala);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT} y escuchando en 0.0.0.0`);
});