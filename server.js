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

// Resolver ventana de tiebreak: valida a cada participante contra todos los patrones permitidos con el mismo último número,
// agrupa por patrón. Si hay múltiples ganadores en un mismo patrón con el mismo número, desempata por dado.
// (tiebreak eliminado en modo multibotón)

// Manejo de conexiones Socket.IO
io.on('connection', (socket) => {
  // Declaración por patrón (UI estándar)
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
    
    // Enviar la tabla seleccionada a cada jugador real individualmente (no bots)
    sala.jugadores.forEach(jugador => {
      if (jugador.tablaSeleccionada) {
        const targetSocket = io.sockets?.sockets?.get?.(jugador.id);
        if (targetSocket) {
          io.to(jugador.id).emit('tablaSeleccionada', { tabla: jugador.tablaSeleccionada });
        }
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

  // (endpoint de agregar bots removido para mantener compatibilidad original)

  // Pausar juego (solo anfitrión)
  socket.on('pausarJuego', (data) => {
    const sala = salas.get(data.salaId);
    if (!sala || sala.anfitrion !== socket.id) return;
    sala.juegoActivo = false;
    const anfitrion = sala.jugadores.find(j => j.id === socket.id);
    io.to(data.salaId).emit('estadoJuego', { estado: 'pausa', por: anfitrion?.nombre || 'anfitrión' });
  });

  // Reanudar juego (solo anfitrión)
  socket.on('reanudarJuego', (data) => {
    const sala = salas.get(data.salaId);
    if (!sala || sala.anfitrion !== socket.id) return;
    sala.juegoActivo = true;
    const anfitrion = sala.jugadores.find(j => j.id === socket.id);
    io.to(data.salaId).emit('estadoJuego', { estado: 'reanudado', por: anfitrion?.nombre || 'anfitrión' });
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

    // Comportamiento básico de bots: marcar el número si lo tienen
    try {
      (sala.jugadores || []).forEach(j => {
        if (!j?.esBot || !j?.tablaSeleccionada) return;
        const loTiene = j.tablaSeleccionada.numeros.some(f => f.some(c => c.numero === numeroAleatorio));
        if (loTiene && !j.numerosMarcados.includes(numeroAleatorio)) {
          j.numerosMarcados.push(numeroAleatorio);
        }
      });
    } catch (_) {}
    
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