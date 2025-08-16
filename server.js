const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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
function verificarBingo(tabla, numerosMarcados, patron) {
  const numerosSet = new Set(numerosMarcados);
  
  switch (patron) {
    case 'linea':
      // Verificar líneas horizontales
      for (let fila = 0; fila < 5; fila++) {
        if (tabla[fila].every(celda => numerosSet.has(celda.numero))) {
          return { ganado: true, tipo: 'línea horizontal', fila: fila + 1 };
        }
      }
      // Verificar líneas verticales
      for (let col = 0; col < 5; col++) {
        if (tabla.every(fila => numerosSet.has(fila[col].numero))) {
          return { ganado: true, tipo: 'línea vertical', columna: col + 1 };
        }
      }
      // Verificar diagonales
      if (tabla[0][0] && tabla[1][1] && tabla[2][2] && tabla[3][3] && tabla[4][4] &&
          numerosSet.has(tabla[0][0].numero) && numerosSet.has(tabla[1][1].numero) && 
          numerosSet.has(tabla[2][2].numero) && numerosSet.has(tabla[3][3].numero) && numerosSet.has(tabla[4][4].numero)) {
        return { ganado: true, tipo: 'línea diagonal', diagonal: 'principal' };
      }
      if (tabla[0][4] && tabla[1][3] && tabla[2][2] && tabla[3][1] && tabla[4][0] &&
          numerosSet.has(tabla[0][4].numero) && numerosSet.has(tabla[1][3].numero) && 
          numerosSet.has(tabla[2][2].numero) && numerosSet.has(tabla[3][1].numero) && numerosSet.has(tabla[4][0].numero)) {
        return { ganado: true, tipo: 'línea diagonal', diagonal: 'secundaria' };
      }
      break;
      
    case 'tablaLlena':
      if (tabla.every(fila => fila.every(celda => numerosSet.has(celda.numero)))) {
        return { ganado: true, tipo: 'tabla llena' };
      }
      break;
      
    case 'cuatroEsquinas':
      if (numerosSet.has(tabla[0][0].numero) && numerosSet.has(tabla[0][4].numero) && 
          numerosSet.has(tabla[4][0].numero) && numerosSet.has(tabla[4][4].numero)) {
        return { ganado: true, tipo: 'cuatro esquinas' };
      }
      break;
      
    case 'loco':
      // LOCO: verificar si el jugador ha marcado exactamente 5 números
      // No importa de qué letra sean, solo que sean exactamente 5
      if (numerosMarcados.length === 5) {
        return { ganado: true, tipo: 'LOCO (5 números)' };
      }
      break;
  }
  
  return { ganado: false };
}

// Manejo de conexiones Socket.IO
io.on('connection', (socket) => {
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
      ganadores: []
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
  
  // Declarar bingo
  socket.on('declararBingo', (data) => {
    const sala = salas.get(data.salaId);
    if (!sala || !sala.juegoActivo) return;
    
    const jugador = sala.jugadores.find(j => j.id === socket.id);
    if (!jugador || !jugador.tablaSeleccionada) return;
    
    // Verificar que este patrón no haya sido ganado ya
    if (sala.ganadores.some(g => g.patron === data.patron)) {
      console.log(`Patrón ${data.patron} ya fue ganado por otro jugador`);
      socket.emit('error', { mensaje: `El patrón ${data.patron} ya fue ganado por otro jugador` });
      return;
    }
    
    // Verificar que el último número marcado sea el último cantado
    const ultimoNumeroCantado = sala.numerosCantados[sala.numerosCantados.length - 1];
    
    // Obtener el último número que marcó el jugador
    const ultimoNumeroMarcado = jugador.numerosMarcados[jugador.numerosMarcados.length - 1];
    
    console.log(`Validación de bingo:`);
    console.log(`- Último número cantado: ${ultimoNumeroCantado}`);
    console.log(`- Último número marcado por ${jugador.nombre}: ${ultimoNumeroMarcado}`);
    console.log(`- Números cantados:`, sala.numerosCantados);
    console.log(`- Números marcados por ${jugador.nombre}:`, jugador.numerosMarcados);
    
    // En bingo real, solo puedes declarar bingo si el último número que marcaste es el último cantado
    if (ultimoNumeroMarcado !== ultimoNumeroCantado) {
      console.log(`❌ Bingo inválido: último número marcado ${ultimoNumeroMarcado} no es el último cantado ${ultimoNumeroCantado}`);
      socket.emit('error', { mensaje: 'Bingo inválido: debes declarar bingo con el último número que marcaste' });
      return;
    }
    
    console.log(`✅ Validación de tiempo exitosa`);
    
    // Filtrar solo los números marcados que estén en la tabla del jugador
    const numerosValidos = jugador.numerosMarcados.filter(numero => {
      return jugador.tablaSeleccionada.numeros.some(fila => 
        fila.some(celda => celda.numero === numero)
      );
    });
    
    console.log(`Validando bingo para ${jugador.nombre}:`);
    console.log(`- Patrón: ${data.patron}`);
    console.log(`- Números marcados originales:`, jugador.numerosMarcados);
    console.log(`- Números válidos en tabla:`, numerosValidos);
    console.log(`- Tabla del jugador:`, jugador.tablaSeleccionada.numeros);
    console.log(`- Estado del juego ANTES:`, sala.juegoActivo);
    console.log(`- Último número cantado:`, ultimoNumeroCantado);
    console.log(`- Número ganador declarado:`, data.numeroGanador);
    
    const resultado = verificarBingo(
      jugador.tablaSeleccionada.numeros,
      numerosValidos, // Usar solo números válidos
      data.patron
    );
    
    console.log(`- Resultado de validación:`, resultado);
    
    if (resultado.ganado) {
      const ganador = {
        jugador: {
          id: jugador.id,
          nombre: jugador.nombre,
          tablaSeleccionada: jugador.tablaSeleccionada,
          numerosMarcados: numerosValidos // Usar números válidos
        },
        patron: data.patron,
        resultado: resultado,
        numeroGanador: data.numeroGanador
      };
      
      sala.ganadores.push(ganador);
      
      // Solo detener el juego si es "tabla llena"
      if (data.patron === 'tablaLlena') {
        sala.juegoActivo = false; // Detener el juego permanentemente
        io.to(data.salaId).emit('bingoDeclarado', ganador);
        io.to(data.salaId).emit('juegoTerminado', { mensaje: `¡${jugador.nombre} ganó con ${resultado.tipo}!` });
      } else {
        // Para otros patrones, pausar el canto por 5 segundos
        sala.juegoActivo = false; // Pausa temporal
        setTimeout(() => {
          sala.juegoActivo = true;
          io.to(data.salaId).emit('juegoReanudado', { mensaje: '¡El juego continúa!' });
        }, 5000);
      }
      
      console.log(`- Estado del juego DESPUÉS:`, sala.juegoActivo);
      io.to(data.salaId).emit('bingoDeclarado', ganador);
      console.log(`¡BINGO! ${jugador.nombre} ganó con ${resultado.tipo}`);
    } else {
      console.log(`Bingo inválido para ${jugador.nombre} con patrón ${data.patron}`);
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
  
  // Desconexión
  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
    
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
  
  const todosLosNumeros = [];
  for (let i = 1; i <= 75; i++) {
    todosLosNumeros.push(i);
  }
  
  // Mezclar el array de números para mayor aleatoriedad
  function mezclarArray(array) {
    const arrayMezclado = [...array];
    for (let i = arrayMezclado.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arrayMezclado[i], arrayMezclado[j]] = [arrayMezclado[j], arrayMezclado[i]];
    }
    return arrayMezclado;
  }
  
  // Mezclar los números disponibles
  let numerosDisponibles = mezclarArray(todosLosNumeros);
  
  console.log(`🎲 Iniciando canto automático con números mezclados:`, numerosDisponibles.slice(0, 10), '...');
  
  const intervalo = setInterval(() => {
    // Solo detener si hay tabla llena
    const hayTablaLlena = sala.ganadores.some(g => g.patron === 'tablaLlena');
    
    if (hayTablaLlena) {
      console.log(`Canto automático detenido permanentemente por tabla llena`);
      clearInterval(intervalo);
      return;
    }
    
    // Si el juego está pausado, no cantar números pero mantener el intervalo
    if (!sala.juegoActivo) {
      console.log(`Canto automático pausado - esperando reanudación...`);
      return;
    }
    
    // Filtrar números que ya fueron cantados
    numerosDisponibles = numerosDisponibles.filter(num => !sala.numerosCantados.includes(num));
    
    if (numerosDisponibles.length === 0) {
      clearInterval(intervalo);
      io.to(salaId).emit('juegoTerminado', { mensaje: 'Se cantaron todos los números' });
      return;
    }
    
    // Tomar el primer número del array mezclado (más aleatorio)
    const numeroAleatorio = numerosDisponibles[0];
    const letraBingo = obtenerLetraBingo(numeroAleatorio);
    sala.numerosCantados.push(numeroAleatorio);
    
    console.log(`🎯 Cantando número: ${letraBingo}${numeroAleatorio} (números restantes: ${numerosDisponibles.length})`);
    
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
  if (!sala) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }
  res.json(sala);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
