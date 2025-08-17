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

// Cooldown para declarar bingo
let ultimoBingoClickMs = 0;
const BINGO_COOLDOWN_MS = 1500;

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
    // Botones de la pantalla de inicio
    document.getElementById('btnCrearSala').addEventListener('click', crearSala);
    document.getElementById('btnUnirseSala').addEventListener('click', unirseSala);
    
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
    
    // Botones de bingo
    document.querySelectorAll('.btn-bingo').forEach(btn => {
        btn.addEventListener('click', declararBingo);
    });
    
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
}

// Funciones de navegación
function mostrarPantalla(pantallaId) {
    document.querySelectorAll('.pantalla').forEach(pantalla => {
        pantalla.classList.add('oculta');
    });
    document.getElementById(pantallaId).classList.remove('oculta');
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

function marcarNumero(numero) {
    socket.emit('marcarNumero', {
        salaId: salaActual.id,
        numero: numero
    });
}

function declararBingo(e) {
    const ahora = Date.now();
    if (ahora - ultimoBingoClickMs < BINGO_COOLDOWN_MS) {
        mostrarNotificacion('Espera un momento antes de declarar de nuevo', 'info');
        return;
    }
    ultimoBingoClickMs = ahora;
    const patron = e.target.closest('.btn-bingo').dataset.patron;
    const numeroActual = document.getElementById('numeroActual').textContent;
    
    // Extraer solo el número del texto (puede ser "B15" o solo "15")
    let numeroGanador = numeroActual;
    if (numeroActual.match(/^[BINGO]\d+$/)) {
        numeroGanador = numeroActual.substring(1); // Quitar la letra
    }
    
    socket.emit('declararBingo', {
        salaId: salaActual.id,
        patron: patron,
        numeroGanador: numeroGanador
    });
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
    
    // Actualizar los botones de bingo según la configuración
    if (salaActual.configuracion && salaActual.configuracion.patrones) {
        actualizarBotonesBingo(salaActual.configuracion.patrones);
    }
    
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
    mostrarModalBingo(ganador);
    if (salaActual) {
        salaActual.ganadores = salaActual.ganadores || [];
        const yaExiste = salaActual.ganadores.some(g => g.jugador && g.jugador.id === ganador.jugador.id && g.patron === ganador.patron);
        if (!yaExiste) salaActual.ganadores.push(ganador);
    }
    // Historial
    agregarEventoHistorial(`🏆 ${ganador.jugador.nombre} ganó ${obtenerNombrePatron(ganador.patron)}`);
    mostrarNotificacion(`¡${ganador.jugador.nombre} ganó con ${ganador.resultado.tipo}!`, 'exito');
    playBingo();
    const btn = document.querySelector(`.btn-bingo[data-patron="${ganador.patron}"]`);
    if (btn) btn.disabled = true;
    if (ganador.patron !== 'tablaLlena') {
        iniciarTemporizadorModal(5);
        setTimeout(() => { mostrarNotificacion('El juego se pausa por 5 segundos...', 'info'); }, 1000);
    } else {
        iniciarCuentaRegresivaFinal(5);
    }
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

function actualizarBotonesBingo(patrones) {
    const botonesBingo = document.querySelectorAll('.btn-bingo');
    botonesBingo.forEach(btn => {
        const patron = btn.dataset.patron;
        if (patrones.includes(patron)) {
            btn.style.display = 'inline-block';
            btn.disabled = false;
        } else {
            btn.style.display = 'none';
            btn.disabled = true;
        }
    });
}

function manejarJuegoTerminado(data) {
    agregarEventoHistorial('⏹️ El juego terminó');
    mostrarNotificacion(data.mensaje, 'exito');
    setTimeout(() => { volverInicio(); }, 5000); // esperar 5s para volver al inicio cuando termina por tabla llena o sin números
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
    
    mensaje.textContent = `¡${ganador.jugador.nombre} ha ganado!`;
    
    let tablaHTML = '';
    if (ganador.jugador.tablaSeleccionada) {
        tablaHTML = `
            <div class="tabla-ganador">
                <h4>Tabla del Ganador:</h4>
                <div class="tabla-bingo-mini">
                    ${ganador.jugador.tablaSeleccionada.numeros.map((fila, filaIndex) => 
                        fila.map((celda, colIndex) => {
                            const esMarcado = ganador.jugador.numerosMarcados.includes(celda.numero) || celda.esLibre;
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
        <p><strong>Patrón:</strong> ${ganador.resultado.tipo}</p>
        <p><strong>Número ganador:</strong> ${ganador.numeroGanador}</p>
        ${tablaHTML}
    `;
    
    modal.classList.remove('oculta');
}

function esGanadorEnPatron(patron, resultado, filaIndex, colIndex, esMarcado) {
    if (!esMarcado) return false;
    switch (patron) {
        case 'linea':
            if (resultado.fila && (resultado.fila - 1) === filaIndex) return true;
            if (resultado.columna && (resultado.columna - 1) === colIndex) return true;
            break;
        case 'cuatroEsquinas':
            if ((filaIndex === 0 || filaIndex === 4) && (colIndex === 0 || colIndex === 4)) return true;
            break;
        case 'loco':
            return true;
        case 'tablaLlena':
            return true;
        case 'machetaso':
            // Solo resaltar la diagonal completa que ganó (usar info de resultado.diagonal si existe)
            const esPrincipal = (resultado && resultado.diagonal === 'principal');
            const esSecundaria = (resultado && resultado.diagonal === 'secundaria');
            if (esPrincipal && filaIndex === colIndex) return true;
            if (esSecundaria && (filaIndex + colIndex === 4)) return true;
            // Si no viene detalle, por defecto no resaltar (evitar marcar ambas)
            return false;
    }
    return false;
}

function cerrarModal() {
    document.getElementById('modalBingo').classList.add('oculta');
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
    try { socket.disconnect(); } catch (e) {}
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
    
    if (salaActual.juegoActivo) {
        mostrarPantalla('pantallaJuego');
        inicializarPantallaJuego();
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
    // Evitar spam del mismo mensaje en menos de 1.5s
    if (ultimaNotificacion.texto === mensaje && (ahora - ultimaNotificacion.tiempo) < 1500) {
        return;
    }
    ultimaNotificacion = { texto: mensaje, tiempo: ahora };

    const notificaciones = document.getElementById('notificaciones');
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo}`;
    notificacion.textContent = mensaje;
    
    notificaciones.appendChild(notificacion);

    // Limitar a 3 notificaciones visibles
    while (notificaciones.childElementCount > 3) {
        notificaciones.firstElementChild.remove();
    }
    
    if (tipo === 'exito') {
        playSuccess();
    } else if (tipo === 'error') {
        playError();
    } else {
        playNotification();
    }
    
    setTimeout(() => {
        notificacion.remove();
    }, 4000);
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
    salaActual = null;
    jugadorActual = null;
    tablaSeleccionada = null;
    numerosMarcados = [];
    numerosCantados = [];
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
    enPausa: false
};

function configurarOfflineListeners() {
    const go = (id) => { document.querySelectorAll('.pantalla').forEach(p => p.classList.add('oculta')); document.getElementById(id).classList.remove('oculta'); };
    const btnPresencial = document.getElementById('btnModoPresencial');
    if (btnPresencial) btnPresencial.addEventListener('click', () => go('pantallaOfflineSetup'));
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
    if (btnCancelarOfflineBingo) btnCancelarOfflineBingo.addEventListener('click', () => document.getElementById('modalOfflineBingo').classList.add('oculta'));

    const btnConfirmarOfflineBingo = document.getElementById('btnConfirmarOfflineBingo');
    if (btnConfirmarOfflineBingo) btnConfirmarOfflineBingo.addEventListener('click', verificarOfflineBingo);
}

function imprimirTablasOffline() {
    // Generar 21 tablas fijas reproducibles a partir de una semilla constante
    const pdfWindow = window.open('', '_blank');
    const seed = 12345; // semilla fija
    const tablas = generarTablasFijas(seed, 21);
    const estilos = `<style>body{font-family:Arial;padding:20px} .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px} .card{border:1px solid #ccc;border-radius:8px;padding:8px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;text-align:center;padding:6px} .cod{font-weight:700;margin:6px 0} .free{background:#faf089}</style>`;
    let html = `<html><head><title>Tablas Presenciales</title>${estilos}</head><body><h2>Tablas Presenciales</h2><div class='grid'>`;
    tablas.forEach((t,i) => {
        html += `<div class='card'><div class='cod'>OFF-${String(i+1).padStart(3,'0')}</div><table><thead><tr><th>B</th><th>I</th><th>N</th><th>G</th><th>O</th></tr></thead><tbody>`;
        t.numeros.forEach((fila,fIdx)=>{
            html += '<tr>' + fila.map((c, cIdx)=> (fIdx===2 && cIdx===2)? `<td class='free'>FREE</td>` : `<td>${c.numero}</td>`).join('') + '</tr>';
        });
        html += `</tbody></table></div>`;
    });
    html += `</div></body></html>`;
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
    const codigos = document.getElementById('codigosOffline').value.split(',').map(s=>s.trim()).filter(Boolean);
    offline.codigosFijos = codigos;
    const patrones = [];
    if (document.getElementById('offlinePatronLinea').checked) patrones.push('linea');
    if (document.getElementById('offlinePatronTablaLlena').checked) patrones.push('tablaLlena');
    if (document.getElementById('offlinePatronCuatroEsquinas').checked) patrones.push('cuatroEsquinas');
    if (document.getElementById('offlinePatronLoco').checked) patrones.push('loco');
    if (document.getElementById('offlinePatronMachetaso').checked) patrones.push('machetaso');
    offline.patrones = patrones;
    offline.numerosCantados = [];
    document.getElementById('historialEventosOffline').innerHTML = '';
    document.querySelectorAll('#offlineNumerosGrid .numero-item').forEach(el=>el.remove());
    document.getElementById('offlineNumeroActual').textContent = '-';
    document.querySelectorAll('.pantalla').forEach(p => p.classList.add('oculta'));
    document.getElementById('pantallaOfflineJuego').classList.remove('oculta');
    agregarEventoHistorialOffline('▶️ Empezó el juego presencial');
    iniciarCantoOffline();
}

function iniciarCantoOffline() {
    if (offline.intervalo) clearInterval(offline.intervalo);
    const todos = Array.from({length:75}, (_,i)=>i+1);
    let disponibles = [...todos];
    function pick(){ return disponibles.splice(Math.floor(Math.random()*disponibles.length),1)[0]; }
    offline.enPausa = false;
    offline.intervalo = setInterval(()=>{
        if (offline.enPausa) return;
        if (disponibles.length===0) { pararOffline(); agregarEventoHistorialOffline('⏹️ Fin: se cantaron todos los números'); return; }
        const num = pick(); offline.numerosCantados.push(num);
        document.getElementById('offlineNumeroActual').textContent = num;
        renderOfflineNumero(num);
    }, offline.velocidad);
}

function togglePausaOffline() {
    offline.enPausa = !offline.enPausa;
    const btn = document.getElementById('btnPausarOffline');
    btn.innerHTML = offline.enPausa ? '<i class="fas fa-play"></i> Reanudar' : '<i class="fas fa-pause"></i> Pausar';
    agregarEventoHistorialOffline(offline.enPausa? '⏸️ Pausa': '⏯️ Reanudado');
}

function pararOffline() { if (offline.intervalo) clearInterval(offline.intervalo); offline.intervalo = null; }

function renderOfflineNumero(num) {
    const grid = document.getElementById('offlineNumerosGrid');
    const div = document.createElement('div');
    div.className = 'numero-item cantado';
    div.textContent = num; grid.appendChild(div);
}

function abrirModalOfflineBingo() { offline.enPausa = true; document.getElementById('modalOfflineBingo').classList.remove('oculta'); }

function verificarOfflineBingo() {
    const input = document.getElementById('inputCodigoOfflineBingo');
    const codigo = input.value.trim();
    if (!codigo) { mostrarNotificacion('Ingresa un código', 'error'); return; }
    if (offline.codigosFijos.length && !offline.codigosFijos.includes(codigo)) {
        mostrarNotificacion('Código no ingresado en esta partida', 'error'); return;
    }
    // Reconstruir tabla fija por código (OFF-XXX) usando la misma semilla y el índice
    const idx = parseInt(codigo.split('-')[1],10)-1; if (isNaN(idx) || idx<0) { mostrarNotificacion('Código inválido', 'error'); return; }
    const tabla = generarTablasFijas(12345, idx+1)[idx];
    // Evaluar patrones con los números cantados
    const resultado = evaluarPatronesOffline(tabla.numeros, offline.numerosCantados, offline.patrones);
    const resDiv = document.getElementById('resultadoOfflineBingo');
    if (resultado.ganado) {
        resDiv.innerHTML = `<span style='color:#2f855a;'>✅ ${codigo} ganó: ${resultado.detalle}</span>`;
        agregarEventoHistorialOffline(`🏆 ${codigo} ganó ${resultado.detalle}`);
    } else {
        resDiv.innerHTML = `<span style='color:#c53030;'>❌ ${codigo} no tiene bingo válido</span>`;
    }
}

function evaluarPatronesOffline(tabla, cantados, patronesHabilitados) {
    // Centro FREE
    const isMarked = (celda) => !!(celda && (cantados.includes(celda.numero) || celda.esLibre===true));
    const ultimo = cantados[cantados.length-1];
    const incluyeUltimo = (fila,col)=>{ try { const c = tabla[fila][col]; return c.esLibre===true || c.numero===ultimo; } catch{return false;}}
    if (patronesHabilitados.includes('linea')) {
        for (let col=0; col<5; col++) {
            const completa = [0,1,2,3,4].every(f=>isMarked(tabla[f][col]));
            if (completa && [0,1,2,3,4].some(f=>incluyeUltimo(f,col))) return {ganado:true, detalle:'Línea (vertical)'}
        }
        for (let fila=0; fila<5; fila++) {
            const completa = tabla[fila].every(c=>isMarked(c));
            if (completa && tabla[fila].some(c=>c.esLibre===true || c.numero===ultimo)) return {ganado:true, detalle:'Línea (horizontal)'}
        }
    }
    if (patronesHabilitados.includes('cuatroEsquinas')) {
        const corners = [tabla[0][0],tabla[0][4],tabla[4][0],tabla[4][4]];
        if (corners.every(isMarked) && corners.some(c=>c.numero===ultimo)) return {ganado:true, detalle:'Cuatro Esquinas'}
    }
    if (patronesHabilitados.includes('loco')) {
        const marcados = new Set(cantados);
        if (marcados.size>=5 && marcados.has(ultimo)) return {ganado:true, detalle:'LOCO (5 números)'}
    }
    if (patronesHabilitados.includes('machetaso')) {
        const dP = [0,1,2,3,4].every(i=>isMarked(tabla[i][i])) && [0,1,2,3,4].some(i=>incluyeUltimo(i,i));
        const dS = [0,1,2,3,4].every(i=>isMarked(tabla[i][4-i])) && [0,1,2,3,4].some(i=>incluyeUltimo(i,4-i));
        if (dP) return {ganado:true, detalle:'Machetaso (diagonal principal)'};
        if (dS) return {ganado:true, detalle:'Machetaso (diagonal secundaria)'};
    }
    if (patronesHabilitados.includes('tablaLlena')) {
        const completa = tabla.every(fila=>fila.every(isMarked));
        if (completa && tabla.some(f=>f.some(c=>c.esLibre===true||c.numero===ultimo))) return {ganado:true, detalle:'Tabla Llena'}
    }
    return {ganado:false}
}
