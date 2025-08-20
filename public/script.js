// Variables globales
let socket;
let salaActual = null;
let jugadorActual = null;
let tablaSeleccionada = null;
let numerosMarcados = [];
let numerosCantados = [];
let nombrePendiente = null;
let accionPendiente = null; // 'crearSala' o 'unirseSala'
let ultimaNotificacion = { texto: '', tiempo: 0 };
let ultimoEventoHist = { texto: '', tiempo: 0 };

// Sistema de notificaciones inteligente
let notificacionesActivas = new Map(); // Para agrupar notificaciones similares
let contadorNotificaciones = 0;

// Cooldown para declarar bingo
let ultimoBingoClickMs = 0;
const BINGO_COOLDOWN_MS = 1500;
let ultimoBingoClickNumero = null;
let ultimoBingoClickPatron = null;

// Función para obtener letra B-I-N-G-O según el número
function obtenerLetraBingo(numero) {
    if (numero >= 1 && numero <= 15) return 'B';
    if (numero >= 16 && numero <= 30) return 'I';
    if (numero >= 31 && numero <= 45) return 'N';
    if (numero >= 46 && numero <= 60) return 'G';
    if (numero >= 61 && numero <= 75) return 'O';
    return '';
}

// Función para reproducir voz del número cantado
function reproducirVozNumero(numero, letra) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance();
        utterance.text = `${letra} ${numero}`;
        utterance.lang = 'es-ES';
        utterance.rate = 0.8;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Cancelar cualquier voz anterior
        speechSynthesis.cancel();
        
        // Reproducir la nueva voz
        speechSynthesis.speak(utterance);
    }
}

function mostrarTutorialSiCorresponde() {
    try {
        const noMostrar = sessionStorage.getItem('bingo_no_tutorial') === '1';
        if (noMostrar) return;
        const modal = document.getElementById('modalTutorial');
        modal.classList.remove('oculta');
    } catch (_) {}
}

function configurarTutorial() {
    const btnCerrar = document.getElementById('btnCerrarTutorial');
    const chkNoMostrar = document.getElementById('chkNoMostrarTutorial');
    const modal = document.getElementById('modalTutorial');
    if (!btnCerrar || !chkNoMostrar) return;

    function cerrar() {
        if (chkNoMostrar.checked) {
            try { sessionStorage.setItem('bingo_no_tutorial', '1'); } catch (_) {}
        }
        modal.classList.add('oculta');
    }

    btnCerrar.addEventListener('click', cerrar);
}

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    inicializarSocket();
    configurarEventListeners();
    configurarTutorial();
    configurarOfflineListeners();
    mostrarPantalla('pantallaInicio');
    intentarRehidratarEstado();
});

// Inicializar Socket.IO
function inicializarSocket() {
    socket = io();
    
    // Eventos de Socket.IO
    socket.on('salaCreada', manejarSalaCreada);
    socket.on('unidoSala', manejarUnidoSala);
    socket.on('jugadorUnido', manejarJugadorUnido);
    socket.on('tablaOcupada', manejarTablaOcupada);
    socket.on('tablaLiberada', manejarTablaLiberada);
    socket.on('jugadorSeleccionoTabla', manejarJugadorSeleccionoTabla);
    socket.on('juegoIniciado', manejarJuegoIniciado);
    socket.on('numeroCantado', manejarNumeroCantado);
    socket.on('numeroMarcado', manejarNumeroMarcado);
    socket.on('bingoDeclarado', manejarBingoDeclarado);
    socket.on('tiebreakIniciado', manejarTiebreakIniciado);
    socket.on('tiebreakResultado', manejarTiebreakResultado);
    socket.on('jugadorDesconectado', manejarJugadorDesconectado);
    socket.on('salaConfigurada', manejarSalaConfigurada);
    socket.on('juegoTerminado', manejarJuegoTerminado);
    socket.on('juegoReanudado', manejarJuegoReanudado);
    socket.on('estadoJuego', manejarEstadoJuego);
    socket.on('error', manejarError);
    socket.on('tablaSeleccionada', manejarTablaSeleccionada);
}

// Configurar event listeners
function configurarEventListeners() {
    // Botón principal de inicio
    document.getElementById('btnJugar').addEventListener('click', irSeleccionModo);
    
    // Botones de la pantalla de selección de modo
    document.getElementById('modoCrearSala').addEventListener('click', crearSala);
    document.getElementById('modoUnirseSala').addEventListener('click', unirseSala);
    
    // Botones de configuración
    document.getElementById('btnIniciarJuego').addEventListener('click', iniciarJuego);
    document.getElementById('btnVolverInicio').addEventListener('click', volverInicio);
    
    // Configuración de velocidad
    document.getElementById('velocidadCanto').addEventListener('input', actualizarVelocidad);
    
    // Controles del anfitrión
    document.getElementById('btnIniciarJuegoRapido').addEventListener('click', iniciarJuegoRapido);
    document.getElementById('velocidadCantoRapido').addEventListener('input', actualizarVelocidadRapida);
    
    // Botones del juego
    document.getElementById('btnPausar').addEventListener('click', pausarJuego);
    document.getElementById('btnSalir').addEventListener('click', abrirModalSalir);
    
    // Modal salir
    const btnCancelarSalir = document.getElementById('btnCancelarSalir');
    const btnConfirmarSalir = document.getElementById('btnConfirmarSalir');
    if (btnCancelarSalir) btnCancelarSalir.addEventListener('click', cerrarModalSalir);
    if (btnConfirmarSalir) btnConfirmarSalir.addEventListener('click', confirmarSalir);
    
    // Botón único de bingo
    const btnBingo = document.getElementById('btnBingo');
    if (btnBingo) btnBingo.addEventListener('click', declararBingoUnico);
    
    // Modal de declaración de bingo
    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
    
    // Modal de nombre
    document.getElementById('btnConfirmarNombre').addEventListener('click', confirmarNombre);
    document.getElementById('btnCancelarNombre').addEventListener('click', cancelarNombre);
    document.getElementById('inputNombre').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            confirmarNombre();
        }
    });
    
    // Enter para unirse a sala
    document.getElementById('codigoSala').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            unirseSala();
        }
    });
    
    // Botón para limpiar notificaciones
    const btnLimpiarNotificaciones = document.getElementById('btnLimpiarNotificaciones');
    if (btnLimpiarNotificaciones) {
        btnLimpiarNotificaciones.addEventListener('click', limpiarNotificaciones);
    }
}

// Funciones de navegación
function mostrarPantalla(pantallaId) {
    document.querySelectorAll('.pantalla').forEach(pantalla => {
        pantalla.classList.add('oculta');
    });
    document.getElementById(pantallaId).classList.remove('oculta');
}

function irSeleccionModo() {
    mostrarPantalla('pantallaSeleccionModo');
}

// Funciones de Socket.IO
function crearSala() {
    const patrones = obtenerPatronesSeleccionados();
    const velocidad = parseInt(document.getElementById('velocidadCanto').value);
    
    accionPendiente = 'crearSala';
    mostrarModalNombre('Ingresa tu nombre como anfitrión:');
}

function unirseSala() {
    const codigo = document.getElementById('codigoSala').value.trim();
    if (!codigo) {
        mostrarNotificacion('Por favor ingresa el código de la sala', 'error');
        return;
    }
    
    accionPendiente = 'unirseSala';
    mostrarModalNombre('Ingresa tu nombre:');
}

function seleccionarTabla(tablaId) {
    if (!salaActual) return;
    
    const tabla = salaActual.tablas.find(t => t.id === tablaId);
    if (!tabla || !tabla.disponible) return;
    
    // Si ya tenía seleccionada otra, remover marca visual en cliente (servidor igualmente la liberará)
    if (tablaSeleccionada && tablaSeleccionada.id !== tablaId) {
        const anteriorEl = document.querySelector(`[data-tabla-id="${tablaSeleccionada.id}"]`);
        if (anteriorEl) anteriorEl.classList.remove('seleccionada');
    }
    
    // Marcar inmediatamente como seleccionada para mejor UX
    const tablaEl = document.querySelector(`[data-tabla-id="${tablaId}"]`);
    if (tablaEl) {
        tablaEl.classList.add('seleccionada');
    }
    
    tablaSeleccionada = tabla;
    
    // Notificar al servidor
    socket.emit('seleccionarTabla', {
        salaId: salaActual.id,
        tablaId: tablaId
    });
    
    mostrarNotificacion(`Tabla ${tablaId + 1} seleccionada`, 'exito');
}

function iniciarJuego() {
    // Verificar que todos los jugadores tengan tabla seleccionada
    if (!verificarTodasLasTablasSeleccionadas()) {
        mostrarNotificacion('Todos los jugadores deben seleccionar una tabla antes de iniciar', 'error');
        return;
    }
    
    const patrones = obtenerPatronesSeleccionados();
    const velocidad = parseInt(document.getElementById('velocidadCanto').value);
    
    socket.emit('configurarSala', {
        salaId: salaActual.id,
        configuracion: {
            patrones: patrones,
            velocidadCanto: velocidad
        }
    });
    
    socket.emit('iniciarJuego', {
        salaId: salaActual.id
    });
}

// Función para verificar que todos los jugadores tengan tabla seleccionada
function verificarTodasLasTablasSeleccionadas() {
    if (!salaActual || !salaActual.jugadores || salaActual.jugadores.length === 0) {
        return false;
    }
    
    // Verificar que todos los jugadores tengan tabla seleccionada
    const jugadoresSinTabla = salaActual.jugadores.filter(j => !j.tablaSeleccionada);
    
    if (jugadoresSinTabla.length > 0) {
        const nombres = jugadoresSinTabla.map(j => j.nombre).join(', ');
        mostrarNotificacion(`Los siguientes jugadores no han seleccionado tabla: ${nombres}`, 'error');
        return false;
    }
    
    return true;
}

function marcarNumero(numero) {
    socket.emit('marcarNumero', {
        salaId: salaActual.id,
        numero: numero
    });
}

function declararBingoUnico() {
    const ahora = Date.now();
    const numeroActualTxt = document.getElementById('numeroActual').textContent;
    let numeroGanador = numeroActualTxt;
    if (numeroActualTxt.match(/^[BINGO]\d+$/)) numeroGanador = numeroActualTxt.substring(1);
    
    // Verificar cooldown
    if ((ahora - ultimoBingoClickMs) < BINGO_COOLDOWN_MS && ultimoBingoClickNumero === numeroGanador) {
        mostrarNotificacion('Espera un momento…', 'info');
        return;
    }
    
    // Verificar que el jugador tenga una tabla seleccionada
    if (!tablaSeleccionada) {
        mostrarNotificacion('Debes seleccionar una tabla antes de declarar bingo', 'error');
        return;
    }
    
    // Verificar que el bingo sea válido antes de enviar al servidor
    if (!verificarBingoValido(numeroGanador)) {
        mostrarNotificacion('Bingo inválido - No tienes un patrón ganador', 'error');
        return;
    }
    
    ultimoBingoClickMs = ahora;
    ultimoBingoClickNumero = numeroGanador;
    socket.emit('declararBingoUnico', { salaId: salaActual.id, numeroGanador: numeroGanador });
}

// Función para verificar si el bingo es válido
function verificarBingoValido(numeroGanador) {
    if (!tablaSeleccionada || !numerosMarcados || numerosMarcados.length === 0) {
        return false;
    }
    
    // Verificar si el número ganador está marcado
    if (!numerosMarcados.includes(parseInt(numeroGanador))) {
        return false;
    }
    
    // Verificar patrones disponibles
    const patronesDisponibles = obtenerPatronesDisponibles();
    
    // Verificar cada patrón disponible
    for (const patron of patronesDisponibles) {
        if (verificarPatronGanado(patron, numeroGanador)) {
            return true; // Al menos un patrón es válido
        }
    }
    
    return false; // Ningún patrón válido
}

// Función para obtener patrones disponibles (no ganados)
function obtenerPatronesDisponibles() {
    if (!salaActual || !salaActual.ganadores) return ['linea', 'cuatroEsquinas', 'loco', 'machetaso', 'tablaLlena'];
    
    const patronesGanados = salaActual.ganadores.map(g => g.patron);
    return ['linea', 'cuatroEsquinas', 'loco', 'machetaso', 'tablaLlena'].filter(p => !patronesGanados.includes(p));
}

// Función para verificar si un patrón específico está ganado
function verificarPatronGanado(patron, numeroGanador) {
    if (!tablaSeleccionada || !numerosMarcados) return false;
    
    const numerosMarcadosSet = new Set(numerosMarcados);
    
    switch (patron) {
        case 'linea':
            // Verificar líneas horizontales
            for (let fila = 0; fila < 5; fila++) {
                let celdaGanadora = false;
                let celdasMarcadas = 0;
                
                for (let col = 0; col < 5; col++) {
                    const celda = tablaSeleccionada.numeros[fila][col];
                    if (celda.esLibre || numerosMarcadosSet.has(celda.numero)) {
                        celdasMarcadas++;
                        if (celda.numero === parseInt(numeroGanador)) {
                            celdaGanadora = true;
                        }
                    }
                }
                
                if (celdasMarcadas === 5 && celdaGanadora) {
                    return true;
                }
            }
            
            // Verificar líneas verticales
            for (let col = 0; col < 5; col++) {
                let celdaGanadora = false;
                let celdasMarcadas = 0;
                
                for (let fila = 0; fila < 5; fila++) {
                    const celda = tablaSeleccionada.numeros[fila][col];
                    if (celda.esLibre || numerosMarcadosSet.has(celda.numero)) {
                        celdasMarcadas++;
                        if (celda.numero === parseInt(numeroGanador)) {
                            celdaGanadora = true;
                        }
                    }
                }
                
                if (celdasMarcadas === 5 && celdaGanadora) {
                    return true;
                }
            }
            break;
            
        case 'cuatroEsquinas':
            const esquinas = [
                tablaSeleccionada.numeros[0][0],
                tablaSeleccionada.numeros[0][4],
                tablaSeleccionada.numeros[4][0],
                tablaSeleccionada.numeros[4][4]
            ];
            
            let esquinasMarcadas = 0;
            let esquinaGanadora = false;
            
            esquinas.forEach(esquina => {
                if (esquina.esLibre || numerosMarcadosSet.has(esquina.numero)) {
                    esquinasMarcadas++;
                    if (esquina.numero === parseInt(numeroGanador)) {
                        esquinaGanadora = true;
                    }
                }
            });
            
            if (esquinasMarcadas === 4 && esquinaGanadora) {
                return true;
            }
            break;
            
        case 'loco':
            let numerosMarcadosEnTabla = 0;
            let numeroGanadorEnTabla = false;
            
            tablaSeleccionada.numeros.forEach(fila => {
                fila.forEach(celda => {
                    if (celda.esLibre || numerosMarcadosSet.has(celda.numero)) {
                        numerosMarcadosEnTabla++;
                        if (celda.numero === parseInt(numeroGanador)) {
                            numeroGanadorEnTabla = true;
                        }
                    }
                });
            });
            
            if (numerosMarcadosEnTabla === 5 && numeroGanadorEnTabla) {
                return true;
            }
            break;
            
        case 'machetaso':
            // Diagonal principal
            let diagonalPrincipalMarcada = 0;
            let diagonalPrincipalGanadora = false;
            
            for (let i = 0; i < 5; i++) {
                const celda = tablaSeleccionada.numeros[i][i];
                if (celda.esLibre || numerosMarcadosSet.has(celda.numero)) {
                    diagonalPrincipalMarcada++;
                    if (celda.numero === parseInt(numeroGanador)) {
                        diagonalPrincipalGanadora = true;
                    }
                }
            }
            
            if (diagonalPrincipalMarcada === 5 && diagonalPrincipalGanadora) {
                return true;
            }
            
            // Diagonal secundaria
            let diagonalSecundariaMarcada = 0;
            let diagonalSecundariaGanadora = false;
            
            for (let i = 0; i < 5; i++) {
                const celda = tablaSeleccionada.numeros[i][4-i];
                if (celda.esLibre || numerosMarcadosSet.has(celda.numero)) {
                    diagonalSecundariaMarcada++;
                    if (celda.numero === parseInt(numeroGanador)) {
                        diagonalSecundariaGanadora = true;
                    }
                }
            }
            
            if (diagonalSecundariaMarcada === 5 && diagonalSecundariaGanadora) {
                return true;
            }
            break;
            
        case 'tablaLlena':
            let tablaCompleta = true;
            let numeroGanadorEnTablaLlena = false;
            
            tablaSeleccionada.numeros.forEach(fila => {
                fila.forEach(celda => {
                    if (!celda.esLibre && !numerosMarcadosSet.has(celda.numero)) {
                        tablaCompleta = false;
                    }
                    if (celda.numero === parseInt(numeroGanador)) {
                        numeroGanadorEnTablaLlena = true;
                    }
                });
            });
            
            if (tablaCompleta && numeroGanadorEnTablaLlena) {
                return true;
            }
            break;
    }
    
    return false;
}

// Manejadores de eventos de Socket.IO
function manejarSalaCreada(data) {
    console.log('🎯 Sala creada:', data);
    salaActual = data.sala;
    jugadorActual = data.jugador;
    
    // Mostrar el código de la sala en la pantalla de selección de tabla
    const codigoElement = document.getElementById('codigoSalaJugador');
    const nombreElement = document.getElementById('nombreJugador');
    
    if (codigoElement) codigoElement.textContent = data.salaId;
    if (nombreElement) nombreElement.textContent = jugadorActual.nombre;

    // También en la pantalla de configuración
    const codigoConfig = document.getElementById('codigoSalaMostrar');
    if (codigoConfig) codigoConfig.textContent = data.salaId;
    
    // Refrescar conteos/listas
    actualizarNumeroJugadores();
    mostrarTablasDisponibles();
    mostrarListaJugadoresSeleccion();
    mostrarPantalla('pantallaSeleccionTabla');
    
    // Mostrar controles del anfitrión
    document.getElementById('controlesAnfitrion').classList.remove('oculta');
    document.body.classList.add('anfitrion');
    
    mostrarNotificacion('Sala creada exitosamente. Selecciona tu tabla para jugar', 'exito');
    // Tutorial
    mostrarTutorialSiCorresponde();
}

function manejarUnidoSala(data) {
    salaActual = data.sala;
    jugadorActual = data.jugador;
    
    document.getElementById('codigoSalaJugador').textContent = salaActual.id;
    document.getElementById('nombreJugador').textContent = jugadorActual.nombre;
    
    actualizarNumeroJugadores();
    mostrarTablasDisponibles();
    mostrarPantalla('pantallaSeleccionTabla');
    
    if (jugadorActual.esAnfitrion) {
        document.getElementById('controlesAnfitrion').classList.remove('oculta');
        document.body.classList.add('anfitrion');
    } else {
        document.getElementById('controlesAnfitrion').classList.add('oculta');
        document.body.classList.remove('anfitrion');
    }
    
    mostrarNotificacion(`Te uniste a la sala como ${jugadorActual.nombre}`, 'exito');
    // Tutorial
    mostrarTutorialSiCorresponde();
}

function manejarJugadorUnido(jugador) {
    console.log('👥 Jugador unido:', jugador);
    
    // Mantener el estado local actualizado
    if (salaActual && Array.isArray(salaActual.jugadores)) {
        const existe = salaActual.jugadores.some(j => j.id === jugador.id);
        if (!existe) salaActual.jugadores.push(jugador);
    }
    
    // Actualizar UI
    actualizarListaJugadores();
    actualizarNumeroJugadores();
    if (document.getElementById('pantallaSeleccionTabla') && !document.getElementById('pantallaSeleccionTabla').classList.contains('oculta')) {
        mostrarListaJugadoresSeleccion();
        actualizarNumeroJugadores();
    }
    
    mostrarNotificacion(`${jugador.nombre} se unió a la sala`, 'exito');
}

function manejarTablaOcupada(data) {
    const tablaElement = document.querySelector(`[data-tabla-id="${data.tablaId}"]`);
    if (tablaElement) {
        tablaElement.classList.add('ocupada');
        tablaElement.classList.remove('seleccionada');
    }
    // Actualizar estado local de la tabla
    if (salaActual && salaActual.tablas) {
        const t = salaActual.tablas.find(tt => tt.id === data.tablaId);
        if (t) t.disponible = false;
    }
}

function manejarTablaLiberada(data) {
    const tablaElement = document.querySelector(`[data-tabla-id="${data.tablaId}"]`);
    if (tablaElement) {
        tablaElement.classList.remove('ocupada');
        tablaElement.classList.remove('seleccionada');
    }
    if (salaActual && salaActual.tablas) {
        const t = salaActual.tablas.find(tt => tt.id === data.tablaId);
        if (t) t.disponible = true;
    }
}

function manejarJugadorSeleccionoTabla(data) {
    if (!salaActual || !Array.isArray(salaActual.jugadores)) return;
    const jugador = salaActual.jugadores.find(j => j.id === data.jugadorId);
    if (jugador) {
        jugador.tablaSeleccionada = data.tabla;
        mostrarListaJugadoresSeleccion();
        actualizarListaJugadores();
    }
}

function manejarJuegoIniciado(data) {
    salaActual = data.sala;
    
    // Buscar la tabla seleccionada del jugador actual en la sala
    const jugadorEnSala = salaActual.jugadores.find(j => j.id === jugadorActual.id);
    if (jugadorEnSala && jugadorEnSala.tablaSeleccionada) {
        tablaSeleccionada = jugadorEnSala.tablaSeleccionada;
    }
    
    // Ocultar/ignorar configuración por patrón en UI (botón único)
    
    mostrarPantalla('pantallaJuego');
    inicializarPantallaJuego();
    
    // Actualizar lista de ganadores si hay alguno
    actualizarListaGanadores();
    
    mostrarNotificacion('¡El juego ha comenzado!', 'exito');
    // Habilitar todos los patrones al inicio
    document.querySelectorAll('.btn-bingo').forEach(b => b.disabled = false);
}

function manejarNumeroCantado(data) {
    numerosCantados = data.numerosCantados;
    document.getElementById('numeroActual').textContent = data.numeroConLetra || data.numero;
    actualizarNumerosCantados();
    
    // Reproducir sonido de número cantado
    playNumberCalled();
    
    // Reproducir voz del número cantado
    const letra = obtenerLetraBingo(data.numero);
    reproducirVozNumero(data.numero, letra);
    
    // Actualizar la tabla para mostrar números cantados (sin marcar automáticamente)
    actualizarTablaBingo();
}

function manejarNumeroMarcado(data) {
    // Solo actualizar si el número no está ya marcado
    if (!numerosMarcados.includes(data.numero)) {
        numerosMarcados.push(data.numero);
    }
    actualizarNumerosMarcados();
    actualizarTablaBingo();
    
    // Reproducir sonido de marcado
    playMark();
}

function manejarBingoDeclarado(ganador) {
    // Verificar si el bingo es válido
    if (!ganador || !ganador.jugador || !ganador.patron) {
        console.log('❌ Bingo inválido recibido del servidor:', ganador);
        mostrarNotificacion('Bingo inválido detectado por el servidor', 'error');
        return;
    }
    
    // Verificar si ya hay un modal abierto para este jugador y número
    const modalAbierto = document.getElementById('modalBingo');
    const esMismoJugadorMismoNumero = modalAbierto && 
        !modalAbierto.classList.contains('oculta') && 
        modalAbierto.dataset.jugadorId === ganador.jugador.id &&
        modalAbierto.dataset.numeroGanador === ganador.numeroGanador;
    
    if (esMismoJugadorMismoNumero) {
        // Agregar este patrón al modal existente
        agregarPatronGanadoAlModal(ganador);
    } else {
        // Mostrar nuevo modal
        mostrarModalBingo(ganador);
    }
    
    if (salaActual) {
        salaActual.ganadores = salaActual.ganadores || [];
        const yaExiste = salaActual.ganadores.some(g => g.jugador && g.jugador.id === ganador.jugador.id && g.patron === ganador.patron);
        if (!yaExiste) salaActual.ganadores.push(ganador);
    }
    
    // Historial
    agregarEventoHistorial(`🏆 ${ganador.jugador.nombre} ganó ${obtenerNombrePatron(ganador.patron)}`);
    mostrarNotificacion(`¡${ganador.jugador.nombre} ganó con ${obtenerNombrePatron(ganador.patron)}!`, 'exito');
    playBingo();
    
    // Deshabilitar botón de bingo para este patrón
    const btn = document.querySelector(`.btn-bingo[data-patron="${ganador.patron}"]`);
    if (btn) btn.disabled = true;
    
    // Verificar si hay empate (múltiples jugadores con el mismo patrón y número)
    verificarEmpate(ganador);
    
    // Solo iniciar temporizador si no es tabla llena
    if (ganador.patron !== 'tablaLlena') {
        iniciarTemporizadorModal(5);
        setTimeout(() => { mostrarNotificacion('El juego se pausa por 5 segundos...', 'info'); }, 1000);
    } else {
        iniciarCuentaRegresivaFinal(5);
    }
}

function manejarTiebreakIniciado(data) {
    // Verificar si realmente hay empate (múltiples jugadores con el mismo patrón y número)
    if (!data || !data.empate || !data.jugadoresEmpatados || data.jugadoresEmpatados.length < 2) {
        console.log('No hay empate real, no se muestra tiebreak');
        return;
    }
    
    mostrarNotificacion(`¡Empate detectado entre ${data.jugadoresEmpatados.length} jugadores! Iniciando desempate...`, 'info');
    
    // Mostrar el modal de tiebreak
    const modal = document.getElementById('modalTiebreak');
    const mensaje = document.getElementById('tiebreakMensaje');
    const resultados = document.getElementById('tiebreakResults');
    const animacion = document.getElementById('tiebreakAnimation');
    
    if (modal && mensaje && resultados && animacion) {
        modal.classList.remove('oculta');
        
        // Mostrar información del empate
        const infoEmpate = document.getElementById('tiebreakInfo');
        if (infoEmpate) {
            infoEmpate.innerHTML = `
                <p><i class="fas fa-info-circle"></i> Empate en: <strong>${obtenerNombrePatron(data.patron)}</strong></p>
                <p><i class="fas fa-dice"></i> Número ganador: <strong>${data.numeroGanador}</strong></p>
                <p><i class="fas fa-users"></i> Jugadores empatados: <strong>${data.jugadoresEmpatados.map(j => j.jugador.nombre).join(', ')}</strong></p>
            `;
        }
        
        mensaje.textContent = `¡Empate entre ${data.jugadoresEmpatados.length} jugadores! Preparando el desempate...`;
        resultados.style.display = 'none';
        animacion.style.display = 'block';
        
        // Iniciar animación secuencial de dados
        iniciarAnimacionSecuencialDados(data.jugadoresEmpatados, data);
    }
}

// Función para iniciar la animación secuencial de dados
function iniciarAnimacionSecuencialDados(jugadores, dataEmpate) {
    const mensaje = document.getElementById('tiebreakMensaje');
    const animacion = document.getElementById('tiebreakAnimation');
    
    if (!mensaje || !animacion) return;
    
    // Guardar jugadores en variable global para acceso posterior
    window.jugadoresTiebreak = jugadores;
    
    let jugadorActual = 0;
    
    function animarJugador() {
        if (jugadorActual >= jugadores.length) {
            // Todos los jugadores han tirado, calcular resultados
            setTimeout(() => {
                mensaje.textContent = 'Calculando resultados...';
                setTimeout(() => {
                    calcularResultadosTiebreak(jugadores, dataEmpate);
                }, 1500);
            }, 1000);
            return;
        }
        
        const jugador = jugadores[jugadorActual];
        mensaje.textContent = `${jugador.jugador.nombre} está tirando los dados...`;
        
        // Animar los dados girando con efecto visual mejorado
        const dados = animacion.querySelectorAll('.dice-spinner');
        dados.forEach((dado, index) => {
            dado.classList.add('rolling');
            // Agregar delay escalonado para los dados
            setTimeout(() => {
                dado.style.animationDelay = `${index * 0.2}s`;
            }, 100);
        });
        
        // Después de 2.5 segundos, mostrar el resultado de este jugador
        setTimeout(() => {
            dados.forEach(dado => {
                dado.classList.remove('rolling');
                dado.style.animationDelay = '0s';
            });
            
            // Generar números aleatorios para este jugador
            const dado1 = Math.floor(Math.random() * 6) + 1;
            const dado2 = Math.floor(Math.random() * 6) + 1;
            
            // Guardar el resultado
            if (!jugador.resultadoDados) {
                jugador.resultadoDados = { dado1, dado2, suma: dado1 + dado2 };
            }
            
            mensaje.textContent = `${jugador.jugador.nombre} sacó ${dado1} + ${dado2} = ${dado1 + dado2}`;
            
            // Pasar al siguiente jugador después de 2 segundos
            setTimeout(() => {
                jugadorActual++;
                animarJugador();
            }, 2000);
            
        }, 2500);
    }
    
    // Iniciar la secuencia
    animarJugador();
}

// Función para calcular los resultados del tiebreak
function calcularResultadosTiebreak(jugadores, dataEmpate) {
    // Verificar si hay empate en los dados
    const resultados = jugadores.map(j => j.resultadoDados);
    const maxSuma = Math.max(...resultados.map(r => r.suma));
    const ganadores = resultados.filter(r => r.suma === maxSuma);
    
    if (ganadores.length > 1) {
        // Hay empate en los dados, volver a tirar
        mostrarNotificacion('¡Empate en los dados! Volviendo a tirar...', 'info');
        
        // Limpiar resultados anteriores
        jugadores.forEach(j => delete j.resultadoDados);
        
        // Reiniciar la animación
        setTimeout(() => {
            iniciarAnimacionSecuencialDados(jugadores, dataEmpate);
        }, 2000);
        
        return;
    }
    
    // Hay un ganador, mostrar resultados
    const ganador = jugadores.find(j => j.resultadoDados.suma === maxSuma);
    
    const resultadoTiebreak = {
        tiradas: jugadores.map(j => ({
            jugadorId: j.jugador.id,
            nombre: j.jugador.nombre,
            dice1: j.resultadoDados.dado1,
            dice2: j.resultadoDados.dado2
        })),
        ganador: { jugadorId: ganador.jugador.id }
    };
    
    manejarTiebreakResultado(resultadoTiebreak);
}

function manejarTiebreakResultado(payload) {
    const modal = document.getElementById('modalTiebreak');
    const lista = document.getElementById('tiebreakLista');
    const msg = document.getElementById('tiebreakMensaje');
    const resultados = document.getElementById('tiebreakResults');
    const animacion = document.getElementById('tiebreakAnimation');
    
    if (!modal || !lista || !msg || !resultados || !animacion) return;
    
    // Ocultar la animación y mostrar los resultados
    animacion.style.display = 'none';
    resultados.style.display = 'block';
    
    // Mensaje final
    msg.textContent = `¡Desempate completado!`;
    
    // Crear las tarjetas de resultados con animación escalonada
    lista.innerHTML = '';
    payload.tiradas.forEach((t, index) => {
        setTimeout(() => {
            const card = document.createElement('div');
            card.className = 'dice-card';
            
            // Crear los dos dados con los números específicos
            const dado1HTML = crearDadoHTML(t.dice1);
            const dado2HTML = crearDadoHTML(t.dice2);
            const suma = t.dice1 + t.dice2;
            const esGanador = payload.ganador && payload.ganador.jugadorId === t.jugadorId;
            
            card.innerHTML = `
                <div class='name'>${t.nombre}</div>
                <div class='dice-pair-result'>
                    <div class='dice ${esGanador ? 'winner' : ''}'>
                        ${dado1HTML}
                    </div>
                    <div class='dice ${esGanador ? 'winner' : ''}'>
                        ${dado2HTML}
                    </div>
                </div>
                <div class='dice-sum'>Suma: ${suma}</div>
                ${esGanador ? '<div class="winner-badge">🏆 Ganador</div>' : ''}
            `;
            
            lista.appendChild(card);
            
            // Animar la entrada de la tarjeta
            setTimeout(() => {
                card.style.animation = 'slideInUp 0.6s ease forwards';
            }, 100);
            
        }, index * 300); // Entrada escalonada más lenta
    });
    
    // Mostrar el modal si no está visible
    if (modal.classList.contains('oculta')) {
        modal.classList.remove('oculta');
    }
    
    // Asegurar que el botón de cerrar sea visible y funcional
    const btn = document.getElementById('btnCerrarTiebreak');
    if (btn) {
        // Hacer el botón visible
        btn.style.display = 'block';
        btn.style.visibility = 'visible';
        btn.style.opacity = '1';
        
        btn.onclick = () => {
            modal.classList.add('oculta');
            // Restaurar la animación para la próxima vez
            setTimeout(() => {
                animacion.style.display = 'block';
                resultados.style.display = 'none';
                // Limpiar las tarjetas
                lista.innerHTML = '';
                // Limpiar resultados de dados
                if (window.jugadoresTiebreak) {
                    window.jugadoresTiebreak.forEach(j => delete j.resultadoDados);
                    delete window.jugadoresTiebreak;
                }
            }, 300);
        };
    } else {
        console.error('❌ Botón de cerrar tiebreak no encontrado');
    }
}

// Función para crear el HTML del dado con el número específico
function crearDadoHTML(numero) {
    const iconosDado = [
        'fas fa-dice-one',
        'fas fa-dice-two', 
        'fas fa-dice-three',
        'fas fa-dice-four',
        'fas fa-dice-five',
        'fas fa-dice-six'
    ];
    
    const icono = iconosDado[numero - 1] || 'fas fa-dice-one';
    return `<i class="${icono}"></i>`;
}

function iniciarCuentaRegresivaFinal(segundos) {
    const modal = document.getElementById('modalBingo');
    const btnCerrar = document.getElementById('btnCerrarModal');
    if (segundos > 0) {
        btnCerrar.textContent = `Volviendo en ${segundos}...`;
        btnCerrar.classList.add('temporizador');
        setTimeout(() => iniciarCuentaRegresivaFinal(segundos - 1), 1000);
    } else {
        btnCerrar.textContent = 'Cerrar';
        btnCerrar.classList.remove('temporizador');
        if (!modal.classList.contains('oculta')) modal.classList.add('oculta');
        volverInicio();
    }
}

function mostrarModalGanadoresFinal() {
    const modal = document.getElementById('modalGanadoresFinal');
    const contenedor = document.getElementById('ganadoresFinales');
    contenedor.innerHTML = '';
    const lista = (salaActual && Array.isArray(salaActual.ganadores)) ? salaActual.ganadores : [];
    if (lista.length > 0) {
        lista.forEach(g => {
            const card = document.createElement('div');
            card.className = 'ganador-categoria';
            const icono = obtenerIconoPatron(g.patron);
            const nombrePatron = obtenerNombrePatron(g.patron);
            card.innerHTML = `
                <div class="icono-categoria ${g.patron}">${icono}</div>
                <div class="info-ganador">
                    <div class="nombre-ganador">${g.jugador.nombre}</div>
                    <div class="tipo-ganador">${nombrePatron}</div>
                </div>
            `;
            contenedor.appendChild(card);
        });
    } else {
        contenedor.innerHTML = '<div style="text-align:center;color:#718096">No hubo ganadores</div>';
    }
    modal.classList.remove('oculta');
    setTimeout(() => {
        modal.classList.add('oculta');
        volverInicio();
    }, 5000);
}

function iniciarTemporizadorModal(segundos) {
    const modal = document.getElementById('modalBingo');
    const btnCerrar = document.getElementById('btnCerrarModal');
    
    if (segundos > 0) {
        btnCerrar.textContent = `Continuando en ${segundos}...`;
        btnCerrar.classList.add('temporizador');
        setTimeout(() => {
            iniciarTemporizadorModal(segundos - 1);
        }, 1000);
    } else {
        btnCerrar.textContent = 'Cerrar';
        btnCerrar.classList.remove('temporizador');
        if (!modal.classList.contains('oculta')) {
            modal.classList.add('oculta');
        }
    }
}

function manejarJugadorDesconectado(jugador) {
    console.log('👋 Jugador desconectado:', jugador);
    
    // Mantener estado local actualizado
    if (salaActual && Array.isArray(salaActual.jugadores)) {
        salaActual.jugadores = salaActual.jugadores.filter(j => j.id !== jugador.id);
    }
    
    // Si se desconectó el anfitrión o no quedan jugadores, limpiar todo
    if (salaActual && (salaActual.anfitrion === jugador.id || salaActual.jugadores.length === 0)) {
        mostrarNotificacion('El anfitrión se desconectó o no quedan jugadores. Limpiando sala...', 'error');
        setTimeout(() => {
            limpiarDatosSala();
            volverInicio();
        }, 3000);
        return;
    }
    
    // Actualizar UI
    actualizarListaJugadores();
    actualizarNumeroJugadores();
    if (document.getElementById('pantallaSeleccionTabla') && !document.getElementById('pantallaSeleccionTabla').classList.contains('oculta')) {
        mostrarListaJugadoresSeleccion();
        actualizarNumeroJugadores();
    }
    
    mostrarNotificacion(`${jugador.nombre} se desconectó`, 'error');
}

function manejarSalaConfigurada(data) {
    salaActual.configuracion = data.configuracion;
    actualizarBotonesBingo(data.configuracion.patrones);
    mostrarNotificacion('Configuración actualizada', 'exito');
}

function actualizarBotonesBingo() { /* sin uso en modo botón único */ }

function manejarJuegoTerminado(data) {
    agregarEventoHistorial('⏹️ El juego terminó');
    mostrarNotificacion(data.mensaje, 'exito');
    
    // Limpiar datos de la sala después de mostrar la notificación
    setTimeout(() => { 
        limpiarDatosSala();
        volverInicio(); 
    }, 5000); // esperar 5s para volver al inicio cuando termina por tabla llena o sin números
}

function manejarJuegoReanudado(data) {
    agregarEventoHistorial(data.mensaje.includes('pausa') ? '⏸️ Juego en pausa' : '⏯️ Juego reanudado');
    mostrarNotificacion(data.mensaje, 'info');
}

function manejarError(data) {
    mostrarNotificacion(data.mensaje, 'error');
    playError();
}

function manejarEstadoJuego(data) {
    if (!data) return;
    if (data.estado === 'pausa') {
        agregarEventoHistorial(`⏸️ Juego en pausa por ${data.por || 'anfitrión'}`);
    } else if (data.estado === 'reanudado') {
        agregarEventoHistorial(`⏯️ Juego reanudado por ${data.por || 'anfitrión'}`);
    }
}

// Funciones de UI
function mostrarTablasDisponibles() {
    const gridTablas = document.getElementById('gridTablas');
    if (!gridTablas || !salaActual) return;
    gridTablas.innerHTML = '';
    
    salaActual.tablas.forEach(tabla => {
        const tablaElement = crearElementoTabla(tabla);
        gridTablas.appendChild(tablaElement);
    });
    
    // Mostrar también la lista de jugadores
    mostrarListaJugadoresSeleccion();
    
    // Verificar estado inicial de los botones de inicio
    verificarEstadoInicioJuego();
}

function mostrarListaJugadoresSeleccion() {
    const listaJugadores = document.getElementById('listaJugadoresSeleccion');
    if (!listaJugadores) return;
    
    listaJugadores.innerHTML = '';
    
    if (salaActual && salaActual.jugadores) {
        salaActual.jugadores.forEach(jugador => {
            const div = document.createElement('div');
            div.className = 'jugador-item';
            if (jugador.id === salaActual.anfitrion) {
                div.classList.add('anfitrion');
            }
            const estadoTabla = jugador.tablaSeleccionada ? `Tabla ${jugador.tablaSeleccionada.id + 1}` : 'Seleccionando...';
            const tipoBadge = jugador.tablaSeleccionada ? 'tabla' : 'seleccionando';
            const crown = jugador.id === salaActual.anfitrion ? '<i class="fas fa-crown crown" title="Anfitrión"></i>' : '';
            
            // Agregar indicador visual de estado
            const estadoIcono = jugador.tablaSeleccionada ? 
                '<i class="fas fa-check-circle" style="color: #48bb78; margin-right: 5px;"></i>' : 
                '<i class="fas fa-clock" style="color: #ed8936; margin-right: 5px;"></i>';
            
            div.innerHTML = `
                <div class="avatar">${jugador.nombre.charAt(0).toUpperCase()}</div>
                <div>
                    <div style="font-weight: 600; display:flex; align-items:center; gap:6px;">${jugador.nombre} ${crown}</div>
                    <div class="badge-estado ${tipoBadge}">${estadoIcono}${estadoTabla}</div>
                </div>
            `;
            
            listaJugadores.appendChild(div);
        });
        
        // Mostrar resumen del estado
        mostrarResumenEstadoTablas();
    }
}

// Función para mostrar resumen del estado de las tablas
function mostrarResumenEstadoTablas() {
    if (!salaActual || !salaActual.jugadores) return;
    
    const totalJugadores = salaActual.jugadores.length;
    const jugadoresConTabla = salaActual.jugadores.filter(j => j.tablaSeleccionada).length;
    const jugadoresSinTabla = totalJugadores - jugadoresConTabla;
    
    // Buscar el elemento de resumen o crearlo
    let resumenElement = document.getElementById('resumenEstadoTablas');
    if (!resumenElement) {
        resumenElement = document.createElement('div');
        resumenElement.id = 'resumenEstadoTablas';
        resumenElement.className = 'resumen-estado-tablas';
        
        // Insertar después de la lista de jugadores
        const listaJugadores = document.getElementById('listaJugadoresSeleccion');
        if (listaJugadores && listaJugadores.parentNode) {
            listaJugadores.parentNode.insertBefore(resumenElement, listaJugadores.nextSibling);
        }
    }
    
    // Actualizar contenido del resumen
    if (jugadoresSinTabla === 0) {
        resumenElement.innerHTML = `
            <div class="resumen-completo">
                <i class="fas fa-check-circle"></i> Todas las tablas están seleccionadas
            </div>
        `;
        resumenElement.className = 'resumen-estado-tablas resumen-completo';
    } else {
        resumenElement.innerHTML = `
            <div class="resumen-pendiente">
                <i class="fas fa-clock"></i> ${jugadoresSinTabla} de ${totalJugadores} jugadores sin tabla
            </div>
        `;
        resumenElement.className = 'resumen-estado-tablas resumen-pendiente';
    }
}

function crearElementoTabla(tabla) {
    const div = document.createElement('div');
    div.className = 'tabla-mini';
    div.dataset.tablaId = tabla.id;
    
    if (!tabla.disponible) {
        div.classList.add('ocupada');
    }
    
    const miniGrid = tabla.numeros.map((fila, filaIndex) =>
        fila.map((celda, colIndex) => {
            if (filaIndex === 2 && colIndex === 2 && celda.esLibre) {
                return `<span class="numero free"><i class=\"fas fa-star\"></i></span>`;
            }
            return `<span class="numero">${celda.numero}</span>`;
        }).join('')
    ).join('');

    div.innerHTML = `
        <div class="tabla-mini-title">Tabla ${tabla.id + 1}</div>
        <div class="mini-grid">${miniGrid}</div>
    `;
    
    if (tabla.disponible) {
        div.addEventListener('click', () => seleccionarTabla(tabla.id));
    }
    
    return div;
}

function inicializarPantallaJuego() {
    document.getElementById('codigoSalaJuego').textContent = salaActual.id;
    actualizarListaJugadores();
    actualizarNumerosCantados();
    actualizarNumerosMarcados();
    if (tablaSeleccionada) {
        // Marcar FREE si aplica
        const centro = tablaSeleccionada?.numeros?.[2]?.[2];
        if (centro && centro.esLibre && !numerosMarcados.includes(centro.numero)) {
            numerosMarcados.push(centro.numero);
        }
        actualizarTablaBingo();
    }
    actualizarListaGanadores();
}

function actualizarNumeroJugadores() {
    const seleccion = document.getElementById('numJugadoresSeleccion');
    const config = document.getElementById('numJugadoresConfig');
    if (salaActual) {
        if (seleccion) seleccion.textContent = salaActual.jugadores.length;
        if (config) config.textContent = salaActual.jugadores.length;
    }
}

function actualizarListaJugadores() {
    const listaJugadores = document.getElementById('listaJugadores');
    if (!listaJugadores || !salaActual) return;
    
    listaJugadores.innerHTML = '';
    
    salaActual.jugadores.forEach(jugador => {
        const div = document.createElement('div');
        div.className = 'jugador-item';
        if (jugador.id === salaActual.anfitrion) {
            div.classList.add('anfitrion');
        }
        const estadoTabla = jugador.tablaSeleccionada ? `Tabla ${jugador.tablaSeleccionada.id + 1}` : 'Seleccionando...';
        const tipoBadge = jugador.tablaSeleccionada ? 'tabla' : 'seleccionando';
        const crown = jugador.id === salaActual.anfitrion ? '<i class="fas fa-crown crown" title="Anfitrión"></i>' : '';
        
        div.innerHTML = `
            <div class="avatar">${jugador.nombre.charAt(0).toUpperCase()}</div>
            <div>
                <div style="font-weight: 600; display:flex; align-items:center; gap:6px;">${jugador.nombre} ${crown}</div>
                <div class="badge-estado ${tipoBadge}">${estadoTabla}</div>
            </div>
        `;
        
        listaJugadores.appendChild(div);
    });
}

function actualizarNumerosCantados() {
    const container = document.getElementById('numerosCantados');
    container.innerHTML = '';
    
    numerosCantados.forEach(numero => {
        const div = document.createElement('div');
        div.className = 'numero-item cantado';
        const letra = obtenerLetraBingo(numero);
        div.textContent = letra ? `${letra}${numero}` : numero;
        container.appendChild(div);
    });
}

function actualizarNumerosMarcados() {
    mostrarInfoDepuracion();
}

function mostrarInfoDepuracion() {
    const infoDiv = document.getElementById('infoDepuracion');
    if (!infoDiv) return;
    
    infoDiv.innerHTML = `
        <div style="font-size: 0.8rem; color: #666; margin-top: 10px;">
            <strong>Info:</strong> Marcados: ${numerosMarcados.length} | Cantados: ${numerosCantados.length}
        </div>
    `;
}

function actualizarTablaBingo() {
    if (!tablaSeleccionada) return;
    
    const tablaBingo = document.getElementById('tablaBingo');
    tablaBingo.innerHTML = '';
    
    // Agregar encabezados B-I-N-G-O
    const letras = ['B', 'I', 'N', 'G', 'O'];
    letras.forEach((letra, index) => {
        const header = document.createElement('div');
        header.className = 'header-bingo';
        header.textContent = letra;
        header.style.gridColumn = index + 1;
        header.style.gridRow = 1;
        tablaBingo.appendChild(header);
    });
    
    tablaSeleccionada.numeros.forEach((fila, filaIndex) => {
        fila.forEach((celda, colIndex) => {
            const elemento = document.createElement('div');
            elemento.className = 'celda-bingo';
            elemento.style.gridColumn = colIndex + 1;
            elemento.style.gridRow = filaIndex + 2; // +2 porque la fila 1 son los headers
            
            if (filaIndex === 2 && colIndex === 2 && celda.esLibre) {
                elemento.classList.add('free');
                elemento.innerHTML = '<i class="fas fa-star"></i>';
            } else {
                elemento.textContent = celda.numero;
            }
            
            if (numerosMarcados.includes(celda.numero)) {
                elemento.classList.add('marcada');
            }
            
            elemento.addEventListener('click', () => {
                if (celda.esLibre) return;
                if (numerosCantados.includes(celda.numero) && !numerosMarcados.includes(celda.numero)) {
                    marcarNumero(celda.numero);
                }
            });
            
            tablaBingo.appendChild(elemento);
        });
    });
    
    mostrarInfoDepuracion();
}

function actualizarListaGanadores() {
    const panel = document.getElementById('panelGanadores');
    const listaGanadores = document.getElementById('listaGanadores');
    if (!listaGanadores || !panel) return;
    
    if (!salaActual || !salaActual.ganadores || salaActual.ganadores.length === 0) {
        panel.style.display = 'none';
        listaGanadores.innerHTML = '';
        return;
    }
    
    panel.style.display = '';
    listaGanadores.innerHTML = '';
    
    salaActual.ganadores.forEach(ganador => {
        const div = document.createElement('div');
        div.className = 'ganador-item';
        div.innerHTML = `
            <div class="avatar">🏆</div>
            <div>
                <div style="font-weight: 500;">${ganador.jugador.nombre}</div>
                <div style="font-size: 0.8rem; color: #718096;">
                    ${ganador.resultado.tipo}
                </div>
            </div>
        `;
        listaGanadores.appendChild(div);
    });
}

function mostrarModalBingo(ganador) {
    const modal = document.getElementById('modalBingo');
    const mensaje = document.getElementById('mensajeBingo');
    const detalles = document.getElementById('detallesBingo');
    
    // Guardar información del jugador y número para identificar ganadores múltiples
    modal.dataset.jugadorId = ganador.jugador.id;
    modal.dataset.numeroGanador = ganador.numeroGanador;
    
    // Crear contenedor para patrones ganados
    const patronesGanados = document.createElement('div');
    patronesGanados.id = 'patronesGanados';
    patronesGanados.className = 'patrones-ganados';
    
    // Agregar el primer patrón ganado
    const primerPatron = crearElementoPatronGanado(ganador);
    patronesGanados.appendChild(primerPatron);
    
    mensaje.textContent = `¡${ganador.jugador.nombre} ha ganado!`;
    
    // Agregar contador de patrones ganados
    const contadorPatrones = document.createElement('div');
    contadorPatrones.className = 'contador-patrones';
    contadorPatrones.innerHTML = `<span class="badge-contador">1 patrón ganado</span>`;
    mensaje.appendChild(contadorPatrones);
    
    let tablaHTML = '';
    if (ganador.jugador.tablaSeleccionada) {
        tablaHTML = `
            <div class="tabla-ganador">
                <h4>Tabla del Ganador:</h4>
                <div class="tabla-bingo-mini">
                    ${ganador.jugador.tablaSeleccionada.numeros.map((fila, filaIndex) => 
                        fila.map((celda, colIndex) => {
                            const esMarcado = ganador.jugador.numerosMarcados.includes(celda.numero) || celda.esLibre;
                            // Verificar si esta celda es ganadora en este patrón
                            const esGanador = esGanadorEnPatron(ganador.patron, ganador.resultado, filaIndex, colIndex, esMarcado);
                            const base = celda.esLibre ? '<span class="numero free"><i class=\"fas fa-star\"></i>' : `<span class=\"numero${esGanador ? ' ganador' : ''}\">${celda.numero}`;
                            return `${base}${esMarcado ? '' : ''}</span>`;
                        }).join('')
                    ).join('')}
                </div>
            </div>
        `;
    }
    
    detalles.innerHTML = `
        <div class="patrones-ganados-container">
            <h4>Patrones Ganados:</h4>
            <div id="patronesGanados" class="patrones-ganados">
                ${primerPatron.outerHTML}
            </div>
        </div>
        <p><strong>Número ganador:</strong> ${ganador.numeroGanador}</p>
        ${tablaHTML}
    `;
    
    // Aplicar modo compacto si es necesario
    aplicarModoCompacto(modal);
    
    modal.classList.remove('oculta');
}

function esGanadorEnPatron(patron, resultado, filaIndex, colIndex, esMarcado) {
    if (!esMarcado) return false;
    
    switch (patron) {
        case 'linea':
            // Línea horizontal
            if (resultado.fila && (resultado.fila - 1) === filaIndex) return true;
            // Línea vertical
            if (resultado.columna && (resultado.columna - 1) === colIndex) return true;
            break;
            
        case 'cuatroEsquinas':
            // Solo las 4 esquinas
            if ((filaIndex === 0 || filaIndex === 4) && (colIndex === 0 || colIndex === 4)) return true;
            break;
            
        case 'loco':
            // Cualquier celda marcada (5 números)
            return true;
            
        case 'tablaLlena':
            // Toda la tabla
            return true;
            
        case 'machetaso':
            // Diagonal principal (esquina superior izquierda a inferior derecha)
            if (resultado.diagonal === 'principal' && filaIndex === colIndex) return true;
            // Diagonal secundaria (esquina superior derecha a inferior izquierda)
            if (resultado.diagonal === 'secundaria' && (filaIndex + colIndex === 4)) return true;
            // Si no hay información de diagonal específica, no resaltar
            return false;
    }
    
    return false;
}

function crearElementoPatronGanado(ganador) {
    const patronDiv = document.createElement('div');
    patronDiv.className = 'patron-ganado';
    patronDiv.dataset.patron = ganador.patron;
    
    const icono = obtenerIconoPatron(ganador.patron);
    const nombrePatron = obtenerNombrePatron(ganador.patron);
    
    patronDiv.innerHTML = `
        <div class="patron-icono">${icono}</div>
        <div class="patron-info">
            <div class="patron-nombre">${nombrePatron}</div>
            <div class="patron-detalle">${ganador.resultado.tipo}</div>
        </div>
    `;
    
    return patronDiv;
}

function agregarPatronGanadoAlModal(ganador) {
    const patronesGanados = document.getElementById('patronesGanados');
    if (!patronesGanados) return;
    
    // Verificar si este patrón ya está mostrado
    const patronExistente = patronesGanados.querySelector(`[data-patron="${ganador.patron}"]`);
    if (patronExistente) return;
    
    // Crear y agregar el nuevo patrón
    const nuevoPatron = crearElementoPatronGanado(ganador);
    patronesGanados.appendChild(nuevoPatron);
    
    // Actualizar la tabla para mostrar todos los patrones ganados
    actualizarTablaConTodosLosPatrones(ganador.jugador.id, ganador.numeroGanador);
    
    // Actualizar el contador de patrones
    actualizarContadorPatrones();
    
    // Mostrar notificación de patrón adicional
    mostrarNotificacion(`¡${ganador.jugador.nombre} también ganó ${obtenerNombrePatron(ganador.patron)}!`, 'exito');
}

function actualizarTablaConTodosLosPatrones(jugadorId, numeroGanador) {
    const modal = document.getElementById('modalBingo');
    if (!modal || modal.classList.contains('oculta')) return;
    
    // Obtener todos los patrones ganados por este jugador con este número
    const patronesGanados = Array.from(modal.querySelectorAll('.patron-ganado')).map(p => p.dataset.patron);
    
    // Buscar la tabla del ganador
    const tablaGanador = salaActual?.jugadores?.find(j => j.id === jugadorId)?.tablaSeleccionada;
    if (!tablaGanador) return;
    
    // Actualizar la tabla para mostrar todos los patrones ganados
    const tablaBingoMini = modal.querySelector('.tabla-bingo-mini');
    if (!tablaBingoMini) return;
    
    tablaBingoMini.innerHTML = tablaGanador.numeros.map((fila, filaIndex) => 
        fila.map((celda, colIndex) => {
            const esMarcado = numerosMarcados.includes(celda.numero) || celda.esLibre;
            // Verificar si esta celda es ganadora en ALGÚN patrón ganado
            let esGanador = false;
            for (const patron of patronesGanados) {
                // Buscar el resultado específico de este patrón en los ganadores
                const ganadorPatron = salaActual?.ganadores?.find(g => 
                    g.jugador.id === jugadorId && 
                    g.patron === patron && 
                    g.numeroGanador === numeroGanador
                );
                
                if (ganadorPatron && esGanadorEnPatron(patron, ganadorPatron.resultado, filaIndex, colIndex, esMarcado)) {
                    esGanador = true;
                    break;
                }
            }
            
            const base = celda.esLibre ? '<span class="numero free"><i class="fas fa-star"></i>' : `<span class="numero${esGanador ? ' ganador' : ''}">${celda.numero}`;
            return `${base}${esMarcado ? '' : ''}</span>`;
        }).join('')
    ).join('');
}

function actualizarContadorPatrones() {
    const modal = document.getElementById('modalBingo');
    if (!modal || modal.classList.contains('oculta')) return;
    
    const contadorPatrones = modal.querySelector('.contador-patrones');
    if (!contadorPatrones) return;
    
    const totalPatrones = modal.querySelectorAll('.patron-ganado').length;
    const texto = totalPatrones === 1 ? '1 patrón ganado' : `${totalPatrones} patrones ganados`;
    
    contadorPatrones.innerHTML = `<span class="badge-contador">${texto}</span>`;
    
    // Aplicar modo compacto si hay muchos patrones
    aplicarModoCompacto(modal);
}

// Función para aplicar modo compacto cuando hay muchos patrones
function aplicarModoCompacto(modal) {
    if (!modal) return;
    
    const totalPatrones = modal.querySelectorAll('.patron-ganado').length;
    const totalJugadores = new Set(Array.from(modal.querySelectorAll('.patron-ganado')).map(p => p.dataset.jugadorId)).size;
    
    // Aplicar modo compacto si hay más de 3 patrones o más de 1 jugador
    if (totalPatrones > 3 || totalJugadores > 1) {
        modal.classList.add('modal-compacto');
    } else {
        modal.classList.remove('modal-compacto');
    }
    
    // Aplicar clase para muchos patrones si hay más de 5
    const contenedorPatrones = modal.querySelector('.patrones-ganados-container');
    if (contenedorPatrones) {
        if (totalPatrones > 5) {
            contenedorPatrones.classList.add('muchos-patrones');
        } else {
            contenedorPatrones.classList.remove('muchos-patrones');
        }
    }
}

function obtenerResultadoPatron(patron) {
    // Buscar el resultado del patrón en los ganadores de la sala
    const ganador = salaActual?.ganadores?.find(g => g.patron === patron);
    return ganador?.resultado || {};
}

function cerrarModal() {
    const modal = document.getElementById('modalBingo');
    modal.classList.add('oculta');
    
    // Limpiar datos del modal para la próxima vez
    delete modal.dataset.jugadorId;
    delete modal.dataset.numeroGanador;
    
    // Limpiar contenedor de patrones ganados
    const patronesGanados = document.getElementById('patronesGanados');
    if (patronesGanados) {
        patronesGanados.innerHTML = '';
    }
}

// Modal salir
function abrirModalSalir() {
    const modal = document.getElementById('modalSalir');
    const msg = document.getElementById('mensajeSalir');
    const tieneTabla = !!(jugadorActual && jugadorActual.tablaSeleccionada);
    const esHost = !!(jugadorActual && jugadorActual.esAnfitrion);
    let texto = 'Perderás tu progreso en esta partida y volverás al menú principal.';
    if (tieneTabla) texto += ' Has seleccionado una tabla y podrías perder tu lugar.';
    if (esHost) texto += ' Eres el anfitrión; los jugadores podrían quedar sin partida.';
    msg.textContent = texto;
    modal.classList.remove('oculta');
}
function cerrarModalSalir() {
    const modal = document.getElementById('modalSalir');
    if (modal) modal.classList.add('oculta');
}
function confirmarSalir() {
    try { 
        limpiarDatosSala();
        socket.disconnect(); 
    } catch (e) {}
    window.location.reload();
}

function manejarTablaSeleccionada(data) {
    tablaSeleccionada = data.tabla;
    
    // Actualizar estado local del jugador actual
    if (jugadorActual) jugadorActual.tablaSeleccionada = data.tabla;
    if (salaActual && salaActual.jugadores) {
        const yo = salaActual.jugadores.find(j => j.id === jugadorActual.id);
        if (yo) yo.tablaSeleccionada = data.tabla;
    }
    // Refrescar disponibilidad local
    if (salaActual && salaActual.tablas) {
        salaActual.tablas.forEach(t => {
            const el = document.querySelector(`[data-tabla-id="${t.id}"]`);
            if (!el) return;
            if (t.id === data.tabla.id) {
                t.disponible = false;
                el.classList.add('seleccionada');
                el.classList.remove('ocupada');
            }
        });
    }
    
    // Visual
    document.querySelectorAll('.tabla-mini').forEach(tabla => {
        const id = parseInt(tabla.dataset.tablaId, 10);
        if (id !== data.tabla.id) tabla.classList.remove('seleccionada');
    });
    
    mostrarListaJugadoresSeleccion();
    actualizarListaJugadores();
    agregarEventoHistorial(`🎴 ${jugadorActual?.nombre || 'Jugador'} seleccionó la tabla ${data.tabla.id + 1}`);
    mostrarNotificacion(`Seleccionaste la tabla ${data.tabla.id + 1}`, 'exito');
    
    // Verificar si todas las tablas están seleccionadas y habilitar botón de iniciar
    verificarEstadoInicioJuego();
    
    if (salaActual.juegoActivo) {
        mostrarPantalla('pantallaJuego');
        inicializarPantallaJuego();
    }
}

// Función para verificar el estado del botón de iniciar juego
function verificarEstadoInicioJuego() {
    if (!salaActual || !salaActual.jugadores) return;
    
    const todasLasTablasSeleccionadas = verificarTodasLasTablasSeleccionadas();
    const btnIniciar = document.getElementById('btnIniciarJuego');
    const btnIniciarRapido = document.getElementById('btnIniciarJuegoRapido');
    
    if (btnIniciar) {
        btnIniciar.disabled = !todasLasTablasSeleccionadas;
        if (todasLasTablasSeleccionadas) {
            btnIniciar.classList.remove('btn-deshabilitado');
            btnIniciar.classList.add('btn-habilitado');
        } else {
            btnIniciar.classList.add('btn-deshabilitado');
            btnIniciar.classList.remove('btn-habilitado');
        }
    }
    
    if (btnIniciarRapido) {
        btnIniciarRapido.disabled = !todasLasTablasSeleccionadas;
        if (todasLasTablasSeleccionadas) {
            btnIniciarRapido.classList.remove('btn-deshabilitado');
            btnIniciarRapido.classList.add('btn-habilitado');
        } else {
            btnIniciarRapido.classList.add('btn-deshabilitado');
            btnIniciarRapido.classList.remove('btn-habilitado');
        }
    }
}

// Modal de nombre
function mostrarModalNombre(mensaje) {
    const modal = document.getElementById('modalNombre');
    const input = document.getElementById('inputNombre');
    const header = modal.querySelector('.modal-header h3');
    
    header.innerHTML = `<i class="fas fa-user"></i> ${mensaje}`;
    input.value = '';
    input.focus();
    modal.classList.remove('oculta');
}

function confirmarNombre() {
    const nombre = document.getElementById('inputNombre').value.trim();
    if (!nombre) {
        mostrarNotificacion('Por favor ingresa un nombre', 'error');
        return;
    }
    
    document.getElementById('modalNombre').classList.add('oculta');
    
    if (accionPendiente === 'crearSala') {
        const velocidad = parseInt(document.getElementById('velocidadCanto').value);
        const patrones = obtenerPatronesSeleccionados();
        socket.emit('crearSala', {
            patrones: patrones,
            velocidadCanto: velocidad,
            nombreAnfitrion: nombre
        });
    } else if (accionPendiente === 'unirseSala') {
        const codigo = document.getElementById('codigoSala').value.trim();
        socket.emit('unirseSala', {
            salaId: codigo,
            nombre: nombre
        });
    }
    
    accionPendiente = null;
}

function cancelarNombre() {
    document.getElementById('modalNombre').classList.add('oculta');
    accionPendiente = null;
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    const ahora = Date.now();
    
    // Sistema anti-spam más inteligente
    const esMismoMensaje = ultimaNotificacion.texto === mensaje;
    const tiempoDesdeUltima = ahora - ultimaNotificacion.tiempo;
    
    // Evitar spam del mismo mensaje
    if (esMismoMensaje && tiempoDesdeUltima < 2000) {
        return;
    }
    
    // Para mensajes de éxito, ser más estrictos
    if (tipo === 'exito' && esMismoMensaje && tiempoDesdeUltima < 3000) {
        return;
    }
    
    // Para mensajes de info, ser más permisivos pero limitar cantidad
    if (tipo === 'info' && esMismoMensaje && tiempoDesdeUltima < 1500) {
        return;
    }
    
    ultimaNotificacion = { texto: mensaje, tiempo: ahora };

    const notificaciones = document.getElementById('notificaciones');
    
    // Limitar a máximo 2 notificaciones visibles para ocupar menos espacio
    const notificacionesExistentes = notificaciones.querySelectorAll('.notificacion');
    if (notificacionesExistentes.length >= 2) {
        // Remover la más antigua
        notificacionesExistentes[0].remove();
    }
    
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo}`;
    notificacion.textContent = mensaje;
    
    // Agregar con animación suave
    notificacion.style.opacity = '0';
    notificacion.style.transform = 'translateX(100%)';
    notificaciones.appendChild(notificacion);
    
    // Animar entrada
    setTimeout(() => {
        notificacion.style.transition = 'all 0.3s ease';
        notificacion.style.opacity = '1';
        notificacion.style.transform = 'translateX(0)';
    }, 10);
    
    // Reproducir sonido solo para tipos importantes
    if (tipo === 'exito') {
        playSuccess();
    } else if (tipo === 'error') {
        playError();
    } else if (tipo === 'info' && !esMismoMensaje) {
        // Solo reproducir sonido de info si es un mensaje nuevo
        playNotification();
    }
    
    // Auto-remover con animación de salida (más rápido)
    setTimeout(() => {
        notificacion.style.opacity = '0';
        notificacion.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notificacion.parentNode) {
                notificacion.remove();
            }
        }, 300);
    }, 2500); // Reducido de 4000 a 2500ms
}

// Función para limpiar todas las notificaciones
function limpiarNotificaciones() {
    const notificaciones = document.getElementById('notificaciones');
    if (notificaciones) {
        notificaciones.innerHTML = '';
    }
    notificacionesActivas.clear();
    contadorNotificaciones = 0;
}

// Función para limpiar completamente los datos de la sala
function limpiarDatosSala() {
    // Limpiar variables globales
    salaActual = null;
    jugadorActual = null;
    tablaSeleccionada = null;
    numerosMarcados = [];
    numerosCantados = [];
    nombrePendiente = null;
    accionPendiente = null;
    ultimaNotificacion = { texto: '', tiempo: 0 };
    ultimoEventoHist = { texto: '', tiempo: 0 };
    ultimoBingoClickMs = 0;
    ultimoBingoClickNumero = null;
    ultimoBingoClickPatron = null;
    
    // Limpiar notificaciones
    limpiarNotificaciones();
    
    // Limpiar historial
    const historial = document.getElementById('historialEventos');
    if (historial) historial.innerHTML = '';
    
    // Limpiar lista de ganadores
    const panelGanadores = document.getElementById('panelGanadores');
    if (panelGanadores) panelGanadores.style.display = 'none';
    
    // Limpiar números cantados y marcados
    const numerosCantadosEl = document.getElementById('numerosCantados');
    if (numerosCantadosEl) numerosCantadosEl.innerHTML = '';
    
    // Limpiar tabla de bingo
    const tablaBingo = document.getElementById('tablaBingo');
    if (tablaBingo) tablaBingo.innerHTML = '';
    
    // Limpiar número actual
    const numeroActual = document.getElementById('numeroActual');
    if (numeroActual) numeroActual.textContent = '-';
    
    // Limpiar modales si están abiertos
    const modalBingo = document.getElementById('modalBingo');
    if (modalBingo) modalBingo.classList.add('oculta');
    
    const modalTiebreak = document.getElementById('modalTiebreak');
    if (modalTiebreak) modalTiebreak.classList.add('oculta');
    
    // Remover clases del body
    document.body.classList.remove('anfitrion');
    
    // Limpiar controles del anfitrión
    const controlesAnfitrion = document.getElementById('controlesAnfitrion');
    if (controlesAnfitrion) controlesAnfitrion.classList.add('oculta');
    
    // Resetear botón de pausa
    const btnPausar = document.getElementById('btnPausar');
    if (btnPausar) {
        btnPausar.dataset.pausado = 'false';
        btnPausar.innerHTML = '<i class="fas fa-pause"></i> Pausar';
    }
    
    console.log('✅ Datos de sala limpiados completamente');
}

// Función para mostrar notificaciones temporales (se auto-ocultan más rápido)
function mostrarNotificacionTemporal(mensaje, tipo = 'info', duracion = 1500) {
    const ahora = Date.now();
    
    // Para notificaciones temporales, ser más permisivos
    if (ultimaNotificacion.texto === mensaje && (ahora - ultimaNotificacion.tiempo) < 800) {
        return;
    }
    
    ultimaNotificacion = { texto: mensaje, tiempo: ahora };
    
    const notificaciones = document.getElementById('notificaciones');
    
    // Limpiar notificaciones existentes si hay muchas
    const notificacionesExistentes = notificaciones.querySelectorAll('.notificacion');
    if (notificacionesExistentes.length >= 2) {
        notificacionesExistentes[0].remove();
    }
    
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo} temporal`;
    notificacion.textContent = mensaje;
    
    // Agregar con animación
    notificacion.style.opacity = '0';
    notificacion.style.transform = 'translateX(100%)';
    notificaciones.appendChild(notificacion);
    
    // Animar entrada
    setTimeout(() => {
        notificacion.style.transition = 'all 0.2s ease';
        notificacion.style.opacity = '1';
        notificacion.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto-remover más rápido
    setTimeout(() => {
        notificacion.style.opacity = '0';
        notificacion.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notificacion.parentNode) {
                notificacion.remove();
            }
        }, 200);
    }, duracion);
}

// Funciones auxiliares
function obtenerNombrePatron(patron) {
    const nombres = {
        'linea': 'Línea',
        'loco': 'LOCO (5 números)',
        'cuatroEsquinas': 'Cuatro Esquinas',
        'tablaLlena': 'Tabla Llena',
        'machetaso': 'Machetaso'
    };
    return nombres[patron] || patron;
}

function obtenerIconoPatron(patron) {
    const iconos = {
        'linea': '<i class="fas fa-minus"></i>',
        'loco': '<i class="fas fa-times"></i>',
        'cuatroEsquinas': '<i class="fas fa-border-all"></i>',
        'tablaLlena': '<i class="fas fa-square"></i>',
        'machetaso': '<i class="fas fa-slash"></i>'
    };
    return iconos[patron] || '<i class="fas fa-trophy"></i>';
}

function obtenerPatronesSeleccionados() {
    const patrones = [];
    if (document.getElementById('patronLinea').checked) patrones.push('linea');
    if (document.getElementById('patronTablaLlena').checked) patrones.push('tablaLlena');
    if (document.getElementById('patronCuatroEsquinas').checked) patrones.push('cuatroEsquinas');
    if (document.getElementById('patronLoco').checked) patrones.push('loco');
    if (document.getElementById('patronMachetaso')?.checked) patrones.push('machetaso');
    return patrones;
}

function actualizarVelocidad() {
    const velocidad = document.getElementById('velocidadCanto').value;
    const segundos = (velocidad / 1000).toFixed(1);
    document.getElementById('velocidadTexto').textContent = `${segundos} segundos`;
}

function actualizarVelocidadRapida() {
    const velocidad = document.getElementById('velocidadCantoRapido').value;
    const velocidadTexto = document.getElementById('velocidadTextoRapido');
    velocidadTexto.textContent = `${(velocidad/1000).toFixed(1)}s`;
}

function iniciarJuegoRapido() {
    // Verificar que todos los jugadores tengan tabla seleccionada
    if (!verificarTodasLasTablasSeleccionadas()) {
        mostrarNotificacion('Todos los jugadores deben seleccionar una tabla antes de iniciar', 'error');
        return;
    }
    
    const patronesSeleccionados = [];
    document.querySelectorAll('.patrones-rapidos input[type="checkbox"]:checked').forEach(checkbox => {
        patronesSeleccionados.push(checkbox.value);
    });
    const velocidad = document.getElementById('velocidadCantoRapido').value;
    socket.emit('configurarSala', {
        salaId: salaActual.id,
        configuracion: {
            patrones: patronesSeleccionados,
            velocidadCanto: parseInt(velocidad)
        }
    });
    socket.emit('iniciarJuego', { salaId: salaActual.id });
    mostrarNotificacion('Iniciando juego con configuración rápida...', 'info');
}

function volverInicio() {
    mostrarPantalla('pantallaInicio');
    limpiarDatosSala();
}

function pausarJuego() {
    if (!salaActual || !jugadorActual || !jugadorActual.esAnfitrion) return;
    const btn = document.getElementById('btnPausar');
    const pausado = btn.dataset.pausado === 'true';
    if (pausado) {
        btn.dataset.pausado = 'false';
        btn.innerHTML = '<i class="fas fa-pause"></i> Pausar';
        socket.emit('reanudarJuego', { salaId: salaActual.id });
    } else {
        btn.dataset.pausado = 'true';
        btn.innerHTML = '<i class="fas fa-play"></i> Reanudar';
        socket.emit('pausarJuego', { salaId: salaActual.id });
    }
}

function manejarJuegoReanudado(data) {
    mostrarNotificacion(data.mensaje, 'info');
    // Sincronizar texto del botón en todos los clientes
    const btn = document.getElementById('btnPausar');
    if (!btn) return;
    const enPausa = data.mensaje.includes('pausa');
    btn.dataset.pausado = enPausa ? 'true' : 'false';
    btn.innerHTML = enPausa ? '<i class="fas fa-play"></i> Reanudar' : '<i class="fas fa-pause"></i> Pausar';
}

// Historial en vivo
function agregarEventoHistorial(texto) {
    const lista = document.getElementById('historialEventos');
    if (!lista) return;
    const ahora = Date.now();
    if (ultimoEventoHist.texto === texto && (ahora - ultimoEventoHist.tiempo) < 2000) return;
    ultimoEventoHist = { texto, tiempo: ahora };
    const item = document.createElement('div');
    item.className = 'hist-item';
    const hora = new Date();
    const hh = String(hora.getHours()).padStart(2, '0');
    const mm = String(hora.getMinutes()).padStart(2, '0');
    item.innerHTML = `<span class="hist-time">[${hh}:${mm}]</span> ${texto}`;
    lista.prepend(item);
    while (lista.childElementCount > 20) lista.lastElementChild.remove();
}

// Persistencia breve (cliente): al cargar la app, si hay una sala activa asociada al socket, rehidratar estado
async function intentarRehidratarEstado() {
    try {
        if (!salaActual && socket && socket.id) {
            // Endpoint de ejemplo: /api/salas podría listar; podríamos mejorar con un mapping de socket->sala si servidor lo expone
            const res = await fetch('/api/salas');
            const salas = await res.json();
            // Nada que rehidratar aquí sin más endpoints; mantenemos la estructura por si extendemos el backend
            console.log('Salas en servidor:', salas);
        }
    } catch (e) { console.warn('No se pudo rehidratar estado', e); }
}

// ===== Modo Presencial (offline) =====
let offline = {
    activos: false,
    codigosFijos: [], // códigos habilitados
    patrones: ['linea','tablaLlena','cuatroEsquinas','machetaso'],
    velocidad: 3000,
    numerosCantados: [],
    intervalo: null,
    timeoutStart: null,
    enPausa: false,
    patronesGanados: new Set()
};

function configurarOfflineListeners() {
    const go = (id) => { document.querySelectorAll('.pantalla').forEach(p => p.classList.add('oculta')); document.getElementById(id).classList.remove('oculta'); };
    const btnPresencial = document.getElementById('btnModoPresencial');
    if (btnPresencial) btnPresencial.addEventListener('click', () => { go('pantallaOfflineSetup'); poblarSelectorCodigos(); });
    const btnVolverInicioOffline = document.getElementById('btnVolverInicioOffline');
    if (btnVolverInicioOffline) btnVolverInicioOffline.addEventListener('click', () => go('pantallaInicio'));

    const vel = document.getElementById('velocidadOffline');
    if (vel) vel.addEventListener('input', () => { offline.velocidad = parseInt(vel.value); document.getElementById('velocidadOfflineTexto').textContent = `${(offline.velocidad/1000).toFixed(1)} segundos`; });

    const btnImprimir = document.getElementById('btnImprimirTablas');
    if (btnImprimir) btnImprimir.addEventListener('click', imprimirTablasOffline);

    const btnIniciar = document.getElementById('btnIniciarOffline');
    if (btnIniciar) btnIniciar.addEventListener('click', iniciarOffline);

    const btnPausarOffline = document.getElementById('btnPausarOffline');
    if (btnPausarOffline) btnPausarOffline.addEventListener('click', togglePausaOffline);

    const btnSalirOffline = document.getElementById('btnSalirOffline');
    if (btnSalirOffline) btnSalirOffline.addEventListener('click', () => { pararOffline(); document.getElementById('pantallaOfflineSetup').classList.remove('oculta'); document.getElementById('pantallaOfflineJuego').classList.add('oculta'); });

    const btnBingoOffline = document.getElementById('btnBingoOffline');
    if (btnBingoOffline) btnBingoOffline.addEventListener('click', abrirModalOfflineBingo);

    const btnCancelarOfflineBingo = document.getElementById('btnCancelarOfflineBingo');
    if (btnCancelarOfflineBingo) btnCancelarOfflineBingo.addEventListener('click', () => { document.getElementById('modalOfflineBingo').classList.add('oculta'); offline.enPausa = false; const btnConfirmar = document.getElementById('btnConfirmarOfflineBingo'); if (btnConfirmar) btnConfirmar.disabled = false; });

    const btnConfirmarOfflineBingo = document.getElementById('btnConfirmarOfflineBingo');
    if (btnConfirmarOfflineBingo) btnConfirmarOfflineBingo.addEventListener('click', () => {
        const gano = verificarOfflineBingo();
        if (gano) btnConfirmarOfflineBingo.disabled = true;
    });
}

function poblarSelectorCodigos() {
    const cont = document.getElementById('offlineCodesPick');
    if (!cont) return;
    cont.innerHTML = '';
    for (let i=1; i<=20; i++) {
        const code = `OFF-${String(i).padStart(3,'0')}`;
        const chip = document.createElement('div');
        chip.className = 'code-chip';
        chip.textContent = code;
        chip.dataset.code = code;
        chip.addEventListener('click', () => chip.classList.toggle('selected'));
        cont.appendChild(chip);
    }
}

function obtenerCodigosSeleccionados() {
    return Array.from(document.querySelectorAll('#offlineCodesPick .code-chip.selected')).map(el=>el.dataset.code);
}

function imprimirTablasOffline() {
    const pdfWindow = window.open('', '_blank');
    const seed = 12345;
    const tablas = generarTablasFijas(seed, 20);
    const estilos = `<style>@page{size:A4;margin:10mm}body{font-family:Arial;padding:0;margin:0} .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;padding:10px} .card{border:2px solid #333;border-radius:10px;padding:10px;break-inside:avoid} table{width:100%;border-collapse:collapse} th,td{border:1px solid #000;text-align:center;padding:8px;font-size:14px} .cod{font-weight:700;margin:6px 0;font-size:16px} .free{background:#faf089;font-weight:700} .page-break{page-break-after:always}</style>`;
    let html = `<html><head><title>Tablas Presenciales</title>${estilos}</head><body>`;
    for (let i=0;i<tablas.length;i+=6){
        html += `<div class='grid'>`;
        tablas.slice(i,i+6).forEach((t,idx) => {
            const globalIdx = i+idx;
            html += `<div class='card'><div class='cod'>OFF-${String(globalIdx+1).padStart(3,'0')}</div><table><thead><tr><th>B</th><th>I</th><th>N</th><th>G</th><th>O</th></tr></thead><tbody>`;
            t.numeros.forEach((fila,fIdx)=>{
                html += '<tr>' + fila.map((c, cIdx)=> (fIdx===2 && cIdx===2)? `<td class='free'>★</td>` : `<td>${c.numero}</td>`).join('') + '</tr>';
            });
            html += `</tbody></table></div>`;
        });
        html += `</div>`;
        if (i+6<tablas.length) html += `<div class='page-break'></div>`;
    }
    html += `</body></html>`;
    pdfWindow.document.write(html);
    pdfWindow.document.close();
    pdfWindow.focus();
    try { pdfWindow.print(); } catch(_) {}
}

function generarTablasFijas(seed, cantidad) {
    function rng() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
    function genTabla() {
        const cols = [];
        for (let col=0; col<5; col++) {
            const min = col*15+1, max=(col+1)*15; const set = new Set(); const arr=[];
            while(arr.length<5){ const n = Math.floor(rng()*(max-min+1))+min; if(!set.has(n)){set.add(n); arr.push(n);} }
            cols.push(arr);
        }
        const filas=[]; const letras=['B','I','N','G','O'];
        for (let i=0;i<5;i++){ const fila=[]; for(let j=0;j<5;j++){ fila.push({numero: cols[j][i], letra: letras[j]}); } filas.push(fila); }
        filas[2][2] = { numero:0, letra:'FREE', esLibre:true };
        return { numeros: filas };
    }
    const tablas=[]; const used=new Set();
    while(tablas.length<cantidad){ const t = genTabla(); const key=JSON.stringify(t.numeros); if(!used.has(key)){ used.add(key); tablas.push(t); } }
    return tablas;
}

function iniciarOffline() {
    const codigos = obtenerCodigosSeleccionados();
    offline.codigosFijos = codigos;
    const patrones = [];
    if (document.getElementById('offlinePatronLinea').checked) patrones.push('linea');
    if (document.getElementById('offlinePatronTablaLlena').checked) patrones.push('tablaLlena');
    if (document.getElementById('offlinePatronCuatroEsquinas').checked) patrones.push('cuatroEsquinas');
    if (document.getElementById('offlinePatronLoco').checked) patrones.push('loco');
    if (document.getElementById('offlinePatronMachetaso').checked) patrones.push('machetaso');
    offline.patrones = patrones;
    offline.velocidad = parseInt(document.getElementById('velocidadOffline').value || '3000');
    offline.numerosCantados = [];
    offline.patronesGanados = new Set();
    document.getElementById('historialEventosOffline').innerHTML = '';
    const board = document.getElementById('offlineBingoBoard');
    board.innerHTML = '';
    const banda = document.getElementById('offlineNumerosCantados');
    if (banda) banda.innerHTML = '';
    'BINGO'.split('').forEach(ch => { const h = document.createElement('div'); h.className = 'cell header'; h.textContent = ch; board.appendChild(h); });
    for (let row=0; row<15; row++) {
        for (let col=0; col<5; col++) {
            const base = col*15+1; const num = base+row; const c = document.createElement('div'); c.className = 'cell'; c.dataset.num = String(num); c.textContent = num; board.appendChild(c);
        }
    }
    document.getElementById('offlineNumeroActual').textContent = '-';
    document.querySelectorAll('.pantalla').forEach(p => p.classList.add('oculta'));
    document.getElementById('pantallaOfflineJuego').classList.remove('oculta');
    agregarEventoHistorialOffline('▶️ Empezó el juego presencial');
    iniciarCantoOffline();
}

function iniciarCantoOffline() {
    if (offline.intervalo) clearInterval(offline.intervalo);
    if (offline.timeoutStart) clearTimeout(offline.timeoutStart);
    offline.enPausa = false;
    offline.terminado = false;
    offline._numerosDisponibles = Array.from({ length: 75 }, (_, i) => i + 1);
    function tick() {
        if (offline.terminado) return;
        if (offline.enPausa) return;
        if (offline.patronesGanados && offline.patronesGanados.has('tablaLlena')) {
            offline.terminado = true;
            finalizarOfflineSiTablaLlena();
            return;
        }
        if (!offline._numerosDisponibles || offline._numerosDisponibles.length === 0) {
            pararOffline();
            agregarEventoHistorialOffline('⏹️ Fin: se cantaron todos los números');
            return;
        }
        const idx = Math.floor(Math.random() * offline._numerosDisponibles.length);
        const num = offline._numerosDisponibles.splice(idx, 1)[0];
        offline.numerosCantados.push(num);
        const letra = obtenerLetraBingo(num);
        document.getElementById('offlineNumeroActual').textContent = `${letra}${num}`;
        renderOfflineNumero(num);
        if (typeof playNumberCalled === 'function') playNumberCalled();
        reproducirVozNumero(num, letra);
    }
    offline.intervalo = setInterval(tick, offline.velocidad);
}

function togglePausaOffline() {
    offline.enPausa = !offline.enPausa;
    const btn = document.getElementById('btnPausarOffline');
    btn.innerHTML = offline.enPausa ? '<i class="fas fa-play"></i> Reanudar' : '<i class="fas fa-pause"></i> Pausar';
    agregarEventoHistorialOffline(offline.enPausa? '⏸️ Pausa': '⏯️ Reanudado');
}

function pararOffline() {
    if (offline.intervalo) clearInterval(offline.intervalo); offline.intervalo = null;
    if (offline.timeoutStart) clearTimeout(offline.timeoutStart); offline.timeoutStart = null;
}

function renderOfflineNumero(num) {
    const board = document.getElementById('offlineBingoBoard');
    const cell = board.querySelector(`.cell[data-num="${num}"]`);
    if (cell) cell.classList.add('called');
    // actualizar banda de números cantados como online
    const container = document.getElementById('offlineNumerosCantados');
    if (container) {
        const div = document.createElement('div');
        div.className = 'numero-item cantado';
        const letra = obtenerLetraBingo(num);
        div.textContent = letra ? `${letra}${num}` : num;
        container.appendChild(div);
    }
}

function abrirModalOfflineBingo() {
    offline.enPausa = true;
    const modal = document.getElementById('modalOfflineBingo');
    document.getElementById('resultadoOfflineBingo').innerHTML = '';
    document.getElementById('offlineTablaPreview').innerHTML = '';
    const btnConfirmar = document.getElementById('btnConfirmarOfflineBingo');
    if (btnConfirmar) btnConfirmar.disabled = false;
    // Poblar lista de códigos
    const list = document.getElementById('offlineCodesList');
    list.innerHTML = '';
    (offline.codigosFijos || []).forEach(code => {
        const chip = document.createElement('div');
        chip.className = 'code-chip';
        chip.textContent = code;
        chip.dataset.code = code;
        chip.addEventListener('click', () => chip.classList.toggle('selected'));
        list.appendChild(chip);
    });
    modal.classList.remove('oculta');
}

function verificarOfflineBingo() {
    const resDiv = document.getElementById('resultadoOfflineBingo');
    const preview = document.getElementById('offlineTablaPreview');
    resDiv.innerHTML = '';
    preview.innerHTML = '';
    const selected = Array.from(document.querySelectorAll('#offlineCodesList .code-chip.selected')).map(el => el.dataset.code);
    const manual = document.getElementById('inputCodigoOfflineBingo').value.trim();
    const codes = [...new Set([ ...selected, ...(manual ? [manual] : []) ])];
    if (codes.length === 0) { mostrarNotificacion('Selecciona o ingresa al menos un código', 'error'); return false; }
    let huboGanadores = false;
    const patronesGanadoresEstaVerificacion = new Set();
    const allowedPatterns = offline.patrones.filter(p => !offline.patronesGanados.has(p));
    const cards = [];
    codes.forEach(codigo => {
        const card = document.createElement('div');
        card.className = 'result-card';
        let patronCard = '';
        if (offline.codigosFijos.length && !offline.codigosFijos.includes(codigo)) {
            card.classList.add('loser');
            card.innerHTML = `<div class='header'><div class='code'>${codigo}</div><span class='status'>No en partida</span></div>`;
            cards.push(card);
            return;
        }
        const idx = parseInt(codigo.split('-')[1],10)-1; if (isNaN(idx) || idx<0) {
            card.classList.add('loser');
            card.innerHTML = `<div class='header'><div class='code'>${codigo}</div><span class='status'>Código inválido</span></div>`;
            cards.push(card);
            return;
        }
        const tablaObj = generarTablasFijas(12345, idx+1)[idx];
        // Evaluar múltiples patrones posibles con el mismo último número
        const winnersForCard = [];
        allowedPatterns.forEach(p => {
            const resP = evaluarPatronesOffline(tablaObj.numeros, offline.numerosCantados, [p]);
            if (resP && resP.ganado) {
                winnersForCard.push(resP);
                patronesGanadoresEstaVerificacion.add(resP.patron);
                agregarEventoHistorialOffline(`🏆 ${codigo} ganó ${resP.detalle}`);
                huboGanadores = true;
            }
        });
        // Resultado completo (para mostrar "Patrón ya ganado" si aplica)
        const resFull = evaluarPatronesOffline(tablaObj.numeros, offline.numerosCantados, offline.patrones);
        let statusHtml = '';
        if (winnersForCard.length > 0) {
            card.classList.add('winner');
            const detalles = winnersForCard.map(w => w.detalle).join(' • ');
            statusHtml = `<div class='header'><div class='code'>${codigo}</div><span class='status'>Ganador</span></div><div class='detail'>${detalles}</div>`;
        } else if (resFull.ganado && offline.patronesGanados.has(resFull.patron)) {
            card.classList.add('loser');
            statusHtml = `<div class='header'><div class='code'>${codigo}</div><span class='status'>Patrón ya ganado</span></div>`;
        } else {
            card.classList.add('loser');
            statusHtml = `<div class='header'><div class='code'>${codigo}</div><span class='status'>Sin bingo</span></div>`;
        }
        card.innerHTML = statusHtml;
        // tabla preview con resaltado de todos los patrones ganados de esta tarjeta
        const mini = document.createElement('div');
        mini.className = 'tabla-bingo-mini';
        mini.style.marginTop = '8px';
        mini.innerHTML = tablaObj.numeros.map((fila, filaIndex) => 
            fila.map((celda, colIndex) => {
                const esMarcado = offline.numerosCantados.includes(celda.numero) || celda.esLibre;
                let esGanador = false;
                if (winnersForCard.length > 0) {
                    esGanador = winnersForCard.some(w => esGanadorEnPatron(w.patron, mapDetalleAResultado(w), filaIndex, colIndex, esMarcado));
                } else if (resFull && resFull.ganado) {
                    esGanador = esGanadorEnPatron(resFull.patron, mapDetalleAResultado(resFull), filaIndex, colIndex, esMarcado);
                }
                const contenido = celda.esLibre ? '<span class="numero free"><i class="fas fa-star"></i>' : `<span class="numero${esGanador ? ' ganador' : ''}">${celda.numero}`;
                return `${contenido}</span>`;
            }).join('')
        ).join('');
        card.appendChild(mini);
        cards.push(card);
    });
    // Pintar todas las tarjetas y después fijar patrones ganados
    cards.forEach(c => resDiv.appendChild(c));
    patronesGanadoresEstaVerificacion.forEach(p => offline.patronesGanados.add(p));
    if (patronesGanadoresEstaVerificacion.has('tablaLlena')) {
        // Mantener el modal visible con el resumen de ganadores y una cuenta regresiva
        const btnConfirmar = document.getElementById('btnConfirmarOfflineBingo');
        if (btnConfirmar) btnConfirmar.disabled = true;
        let restantes = 5;
        const btnContinuar = document.getElementById('btnCancelarOfflineBingo');
        if (btnContinuar) {
            btnContinuar.textContent = `Volviendo en ${restantes}...`;
            btnContinuar.disabled = true;
            const timer = setInterval(() => {
                restantes -= 1;
                if (btnContinuar) btnContinuar.textContent = `Volviendo en ${restantes}...`;
                if (restantes <= 0) {
                    clearInterval(timer);
                    finalizarOfflineSiTablaLlena();
                }
            }, 1000);
        } else {
            finalizarOfflineSiTablaLlena();
        }
    }
    return huboGanadores;
}

function finalizarOfflineSiTablaLlena() {
    if (offline._finProgramado) return;
    offline._finProgramado = true;
    pararOffline();
    agregarEventoHistorialOffline('🏁 Tabla Llena: finalizando en 5s');
    mostrarNotificacion('¡Tabla Llena! Finalizando en 5 segundos...', 'exito');
    const modal = document.getElementById('modalOfflineBingo');
    if (modal) modal.classList.add('oculta');
    setTimeout(() => {
        const pantalla = document.getElementById('pantallaOfflineJuego');
        if (pantalla) pantalla.classList.add('oculta');
        offline.enPausa = false;
        offline.terminado = true;
        offline._finProgramado = false;
        volverInicio();
    }, 5000);
}

function mapDetalleAPatron(detalle) {
    if (!detalle) return '';
    if (detalle.startsWith('Línea')) return 'linea';
    if (detalle.startsWith('Machetaso')) return 'machetaso';
    if (detalle.startsWith('Cuatro')) return 'cuatroEsquinas';
    if (detalle.startsWith('LOCO')) return 'loco';
    if (detalle.startsWith('Tabla')) return 'tablaLlena';
    return '';
}
function mapDetalleAResultado(resultado) {
    const r = {};
    if (!resultado || !resultado.ganado) return r;
    if (resultado.fila) r.fila = resultado.fila;
    if (resultado.columna) r.columna = resultado.columna;
    if (resultado.diagonal) r.diagonal = resultado.diagonal;
    if (resultado.detalle) {
        if (resultado.detalle.includes('vertical')) r.columna = r.columna || 1;
        if (resultado.detalle.includes('horizontal')) r.fila = r.fila || 1;
        if (resultado.detalle.includes('principal')) r.diagonal = r.diagonal || 'principal';
        if (resultado.detalle.includes('secundaria')) r.diagonal = r.diagonal || 'secundaria';
    }
    return r;
}

function evaluarPatronesOffline(tabla, cantados, patronesPermitidos) {
    const isMarked = (celda) => !!(celda && (cantados.includes(celda.numero) || celda.esLibre===true));
    const ultimo = cantados[cantados.length-1];
    if (patronesPermitidos.includes('linea')) {
        for (let col=0; col<5; col++) {
            const completa = [0,1,2,3,4].every(f=>isMarked(tabla[f][col]));
            const contieneUlt = [0,1,2,3,4].some(f=>tabla[f][col].numero===ultimo);
            if (completa && contieneUlt) return {ganado:true, detalle:'Línea (vertical)', patron:'linea', columna: col+1}
        }
        for (let fila=0; fila<5; fila++) {
            const completa = tabla[fila].every(c=>isMarked(c));
            const contieneUlt = tabla[fila].some(c=>c.numero===ultimo);
            if (completa && contieneUlt) return {ganado:true, detalle:'Línea (horizontal)', patron:'linea', fila: fila+1}
        }
    }
    if (patronesPermitidos.includes('cuatroEsquinas')) {
        const corners = [tabla[0][0],tabla[0][4],tabla[4][0],tabla[4][4]];
        const completas = corners.every(isMarked);
        const ultimoEnCorners = corners.some(c=>c.numero===ultimo);
        if (completas && ultimoEnCorners) return {ganado:true, detalle:'Cuatro Esquinas', patron:'cuatroEsquinas'}
    }
    if (patronesPermitidos.includes('loco')) {
        const setCantados = new Set(cantados);
        const cantCantadosEnTabla = tabla.flat().filter(c=>!c.esLibre && setCantados.has(c.numero)).length;
        if (cantCantadosEnTabla === 5 && setCantados.has(ultimo)) return {ganado:true, detalle:'LOCO (5 números)', patron:'loco'}
    }
    if (patronesPermitidos.includes('machetaso')) {
        const dPCompleta = [0,1,2,3,4].every(i=>isMarked(tabla[i][i]));
        const dSCompleta = [0,1,2,3,4].every(i=>isMarked(tabla[i][4-i]));
        const ultimoEnP = [0,1,2,3,4].some(i=>tabla[i][i].numero===ultimo);
        const ultimoEnS = [0,1,2,3,4].some(i=>tabla[i][4-i].numero===ultimo);
        if (dPCompleta && ultimoEnP) return {ganado:true, detalle:'Machetaso (diagonal principal)', patron:'machetaso', diagonal: 'principal'};
        if (dSCompleta && ultimoEnS) return {ganado:true, detalle:'Machetaso (diagonal secundaria)', patron:'machetaso', diagonal: 'secundaria'};
    }
    if (patronesPermitidos.includes('tablaLlena')) {
        const completa = tabla.every(fila=>fila.every(isMarked));
        const contieneUlt = tabla.some(f=>f.some(c=>c.numero===ultimo));
        if (completa && contieneUlt) return {ganado:true, detalle:'Tabla Llena', patron:'tablaLlena'}
    }
    return {ganado:false}
}

function agregarEventoHistorialOffline(texto) {
    const lista = document.getElementById('historialEventosOffline');
    if (!lista) return;
    const hora = new Date(); const hh = String(hora.getHours()).padStart(2,'0'); const mm = String(hora.getMinutes()).padStart(2,'0');
    const div = document.createElement('div'); div.className = 'hist-item'; div.innerHTML = `<span class='hist-time'>[${hh}:${mm}]</span> ${texto}`; lista.prepend(div);
    while (lista.childElementCount>20) lista.lastElementChild.remove();
}

// Función para verificar si hay empate entre jugadores
function verificarEmpate(ganador) {
    if (!salaActual || !salaActual.ganadores) return;
    
    // Buscar jugadores que ganaron el mismo patrón con el mismo número
    const empates = salaActual.ganadores.filter(g => 
        g.patron === ganador.patron && 
        g.numeroGanador === ganador.numeroGanador &&
        g.jugador.id !== ganador.jugador.id
    );
    
    // Si hay empate, programar tiebreak para después del temporizador
    if (empates.length > 0) {
        const jugadoresEmpatados = [ganador, ...empates];
        const dataEmpate = {
            empate: true,
            jugadoresEmpatados: jugadoresEmpatados,
            patron: ganador.patron,
            numeroGanador: ganador.numeroGanador
        };
        
        console.log(`🎲 Empate detectado entre ${jugadoresEmpatados.length} jugadores en ${ganador.patron} con número ${ganador.numeroGanador}`);
        
        // Programar tiebreak para después del temporizador del modal
        setTimeout(() => {
            iniciarTiebreak(dataEmpate);
        }, 6000); // 5 segundos del temporizador + 1 segundo extra
    }
}

// Función para iniciar el tiebreak
function iniciarTiebreak(dataEmpate) {
    console.log('🎯 Iniciando tiebreak...', dataEmpate);
    
    // Cerrar el modal de bingo si está abierto
    const modalBingo = document.getElementById('modalBingo');
    if (modalBingo && !modalBingo.classList.contains('oculta')) {
        modalBingo.classList.add('oculta');
    }
    
    // Iniciar el tiebreak con animación secuencial
    manejarTiebreakIniciado(dataEmpate);
}