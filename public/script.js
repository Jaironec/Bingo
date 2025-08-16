// Variables globales
let socket;
let salaActual = null;
let jugadorActual = null;
let tablaSeleccionada = null;
let numerosMarcados = [];
let numerosCantados = [];
let nombrePendiente = null;
let accionPendiente = null; // 'crearSala' o 'unirseSala'

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

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    inicializarSocket();
    configurarEventListeners();
    mostrarPantalla('pantallaInicio');
});

// Inicializar Socket.IO
function inicializarSocket() {
    socket = io();
    
    // Eventos de Socket.IO
    socket.on('salaCreada', manejarSalaCreada);
    socket.on('unidoSala', manejarUnidoSala);
    socket.on('jugadorUnido', manejarJugadorUnido);
    socket.on('tablaOcupada', manejarTablaOcupada);
    socket.on('juegoIniciado', manejarJuegoIniciado);
    socket.on('numeroCantado', manejarNumeroCantado);
    socket.on('numeroMarcado', manejarNumeroMarcado);
    socket.on('bingoDeclarado', manejarBingoDeclarado);
    socket.on('jugadorDesconectado', manejarJugadorDesconectado);
    socket.on('salaConfigurada', manejarSalaConfigurada);
    socket.on('juegoTerminado', manejarJuegoTerminado);
    socket.on('juegoReanudado', manejarJuegoReanudado);
    socket.on('error', manejarError);
    socket.on('tablaSeleccionada', manejarTablaSeleccionada);
    socket.on('mostrarModalFinal', manejarModalFinal);
    socket.on('nuevaPartidaIniciada', manejarNuevaPartida);
    socket.on('confirmarNuevaPartida', manejarConfirmarNuevaPartida);
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
    document.getElementById('btnSalir').addEventListener('click', salirJuego);
    document.getElementById('btnNuevaPartidaJuego').addEventListener('click', iniciarNuevaPartidaDesdeJuego);
    
    // Botones de bingo
    document.querySelectorAll('.btn-bingo').forEach(btn => {
        btn.addEventListener('click', declararBingo);
    });
    
    // Modal
    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
    document.getElementById('btnCerrarModalFinal').addEventListener('click', cerrarModalFinal);
    document.getElementById('btnNuevaPartida').addEventListener('click', iniciarNuevaPartida);
    
    // Modal de confirmación nueva partida
    document.getElementById('btnAceptarNuevaPartida').addEventListener('click', aceptarNuevaPartida);
    document.getElementById('btnRechazarNuevaPartida').addEventListener('click', rechazarNuevaPartida);
    
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
    
    // Marcar tabla como seleccionada
    tabla.disponible = false;
    tablaSeleccionada = tabla;
    
    // Actualizar UI
    mostrarTablasDisponibles();
    
    // Notificar al servidor
    socket.emit('seleccionarTabla', {
        salaId: salaActual.id,
        tablaId: tablaId
    });
    
    // Actualizar número de jugadores
    actualizarNumeroJugadores();
    
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
    const numElement = document.getElementById('numJugadores');
    
    console.log('📝 Elementos encontrados:', {
        codigo: codigoElement,
        nombre: nombreElement,
        num: numElement
    });
    
    if (codigoElement) codigoElement.textContent = data.salaId;
    if (nombreElement) nombreElement.textContent = jugadorActual.nombre;
    if (numElement) numElement.textContent = salaActual.jugadores.length;
    
    // Mostrar pantalla de selección de tabla para el anfitrión también
    mostrarTablasDisponibles();
    mostrarPantalla('pantallaSeleccionTabla');
    
    // Mostrar controles del anfitrión
    document.getElementById('controlesAnfitrion').classList.remove('oculta');
    
    // Agregar clase anfitrion al body para CSS
    document.body.classList.add('anfitrion');
    
    console.log('✅ Sala configurada correctamente');
    mostrarNotificacion('Sala creada exitosamente. Selecciona tu tabla para jugar', 'exito');
}

function manejarUnidoSala(data) {
    salaActual = data.sala;
    jugadorActual = data.jugador;
    
    if (jugadorActual.esAnfitrion) {
        // Es anfitrión
        document.getElementById('codigoSalaJugador').textContent = salaActual.id;
        document.getElementById('nombreJugador').textContent = jugadorActual.nombre;
        document.getElementById('numJugadores').textContent = salaActual.jugadores.length;
        mostrarTablasDisponibles();
        mostrarPantalla('pantallaSeleccionTabla');
        
        // Mostrar controles del anfitrión
        document.getElementById('controlesAnfitrion').classList.remove('oculta');
        
        // Agregar clase anfitrion al body para CSS
        document.body.classList.add('anfitrion');
    } else {
        // Es jugador
        document.getElementById('nombreJugador').textContent = jugadorActual.nombre;
        document.getElementById('codigoSalaJugador').textContent = salaActual.id;
        document.getElementById('numJugadores').textContent = salaActual.jugadores.length;
        mostrarTablasDisponibles();
        mostrarPantalla('pantallaSeleccionTabla');
        
        // Ocultar controles del anfitrión
        document.getElementById('controlesAnfitrion').classList.add('oculta');
        
        // Asegurar que no tenga clase anfitrion
        document.body.classList.remove('anfitrion');
    }
    
    mostrarNotificacion(`Te uniste a la sala como ${jugadorActual.nombre}`, 'exito');
}

function manejarJugadorUnido(jugador) {
    console.log('👥 Jugador unido:', jugador);
    
    // Actualizar la lista de jugadores en el juego
    actualizarListaJugadores();
    actualizarNumeroJugadores();
    
    // Si estamos en la pantalla de selección de tablas, actualizar también esa lista
    if (document.getElementById('pantallaSeleccionTabla') && !document.getElementById('pantallaSeleccionTabla').classList.contains('oculta')) {
        console.log('🔄 Actualizando lista de jugadores en selección de tablas');
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
    console.log('🏆 Bingo declarado:', ganador);
    mostrarModalBingo(ganador);
    actualizarListaGanadores();
    mostrarNotificacion(`¡${ganador.jugador.nombre} ganó con ${ganador.resultado.tipo}!`, 'exito');
    
    // Reproducir sonido de bingo
    playBingo();
    
    // Auto-cerrar modal después de 5 segundos con temporizador (excepto para tabla llena)
    if (ganador.patron !== 'tablaLlena') {
        iniciarTemporizadorModal(5);
        // Mostrar notificación de pausa
        setTimeout(() => {
            mostrarNotificacion('El juego se pausa por 5 segundos...', 'info');
        }, 1000);
    }
    // Para tabla llena, el modal se mantiene abierto hasta que se cierre manualmente
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
    
    // Actualizar la lista de jugadores en el juego
    actualizarListaJugadores();
    actualizarNumeroJugadores();
    
    // Si estamos en la pantalla de selección de tablas, actualizar también esa lista
    if (document.getElementById('pantallaSeleccionTabla') && !document.getElementById('pantallaSeleccionTabla').classList.contains('oculta')) {
        console.log('🔄 Actualizando lista de jugadores en selección de tablas');
        mostrarListaJugadoresSeleccion();
        actualizarNumeroJugadores();
    }
    
    mostrarNotificacion(`${jugador.nombre} se desconectó`, 'error');
}

function manejarSalaConfigurada(data) {
    salaActual.configuracion = data.configuracion;
    
    // Actualizar los botones de bingo según la configuración
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
    mostrarNotificacion(data.mensaje, 'exito');
}

function manejarJuegoReanudado(data) {
    mostrarNotificacion(data.mensaje, 'info');
    // El canto automático se reanuda desde el servidor
}

function manejarError(data) {
    mostrarNotificacion(data.mensaje, 'error');
    playError();
}

function manejarModalFinal(data) {
    // Cerrar el modal de bingo si está abierto
    const modalBingo = document.getElementById('modalBingo');
    if (!modalBingo.classList.contains('oculta')) {
        modalBingo.classList.add('oculta');
    }
    
    mostrarModalFinal(data.ganadores);
}

function manejarNuevaPartida(data) {
    console.log('🔄 Nueva partida iniciada:', data);
    mostrarNotificacion('¡La nueva partida ha comenzado!', 'exito');
    
    // Redirigir a la pantalla de selección de tablas
    mostrarPantalla('pantallaSeleccionTabla');
    
    // Actualizar la información de la sala
    if (salaActual) {
        mostrarTablasDisponibles();
        actualizarNumeroJugadores();
        mostrarListaJugadoresSeleccion();
    }
    
    // Mostrar el botón de nueva partida si es anfitrión
    if (jugadorActual && jugadorActual.esAnfitrion) {
        const btnNuevaPartida = document.getElementById('btnNuevaPartidaJuego');
        if (btnNuevaPartida) {
            btnNuevaPartida.style.display = 'inline-block';
        }
    }
}

function manejarConfirmarNuevaPartida(data) {
    console.log('❓ Confirmando nueva partida para invitado');
    
    // Solo mostrar modal si NO es anfitrión
    if (jugadorActual && !jugadorActual.esAnfitrion) {
        const modal = document.getElementById('modalConfirmarNuevaPartida');
        modal.classList.remove('oculta');
    } else {
        console.log('🚫 Anfitrión no debe ver modal de confirmación');
    }
}

function mostrarModalFinal(ganadores) {
    const modal = document.getElementById('modalFinal');
    const ganadoresFinales = document.getElementById('ganadoresFinales');
    
    // Mostrar notificación
    mostrarNotificacion('¡Fin del juego! Revisa todos los ganadores', 'exito');
    
    // Agrupar ganadores por categoría
    const ganadoresPorCategoria = {};
    ganadores.forEach(ganador => {
        if (!ganadoresPorCategoria[ganador.patron]) {
            ganadoresPorCategoria[ganador.patron] = [];
        }
        ganadoresPorCategoria[ganador.patron].push(ganador);
    });
    
    // Crear HTML para cada categoría
    let html = '';
    Object.entries(ganadoresPorCategoria).forEach(([patron, ganadoresCategoria]) => {
        const primerGanador = ganadoresCategoria[0];
        const icono = obtenerIconoPatron(patron);
        const nombrePatron = obtenerNombrePatron(patron);
        
        html += `
            <div class="ganador-categoria">
                <div class="icono-categoria ${patron}">
                    ${icono}
                </div>
                <div class="info-ganador">
                    <div class="nombre-ganador">${primerGanador.jugador.nombre}</div>
                    <div class="tipo-ganador">${nombrePatron}</div>
                    <div class="fecha-ganador">Primer ganador de esta categoría</div>
                </div>
            </div>
        `;
    });
    
    ganadoresFinales.innerHTML = html;
    modal.classList.remove('oculta');
}

function obtenerIconoPatron(patron) {
    const iconos = {
        'linea': '<i class="fas fa-minus"></i>',
        'loco': '<i class="fas fa-times"></i>',
        'cuatroEsquinas': '<i class="fas fa-border-all"></i>',
        'tablaLlena': '<i class="fas fa-square"></i>'
    };
    return iconos[patron] || '<i class="fas fa-trophy"></i>';
}

function obtenerNombrePatron(patron) {
    const nombres = {
        'linea': 'Línea',
        'loco': 'LOCO (5 números)',
        'cuatroEsquinas': 'Cuatro Esquinas',
        'tablaLlena': 'Tabla Llena'
    };
    return nombres[patron] || patron;
}

// Funciones de UI
function mostrarTablasDisponibles() {
    const gridTablas = document.getElementById('gridTablas');
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
            
            div.innerHTML = `
                <div class="avatar">${jugador.nombre.charAt(0).toUpperCase()}</div>
                <div>
                    <div style="font-weight: 500;">${jugador.nombre}</div>
                    <div style="font-size: 0.8rem; color: #718096;">
                        ${jugador.tablaSeleccionada ? `Tabla ${jugador.tablaSeleccionada.id + 1}` : 'Sin tabla'}
                    </div>
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
    
    div.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">Tabla ${tabla.id + 1}</div>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px;">
            ${tabla.numeros.map(fila => 
                fila.map(celda => `<span class="numero">${celda.numero}</span>`).join('')
            ).join('')}
        </div>
    `;
    
    if (tabla.disponible) {
        div.addEventListener('click', () => seleccionarTabla(tabla.id));
    }
    
    return div;
}

function inicializarPantallaJuego() {
    console.log('🎮 Inicializando pantalla de juego');
    document.getElementById('codigoSalaJuego').textContent = salaActual.id;
    
    console.log('📊 Estado de la sala:', {
        id: salaActual.id,
        ganadores: salaActual.ganadores,
        jugadores: salaActual.jugadores.length
    });
    
    actualizarListaJugadores();
    actualizarNumerosCantados();
    actualizarNumerosMarcados();
    
    // Actualizar la tabla de bingo si hay una tabla seleccionada
    if (tablaSeleccionada) {
        actualizarTablaBingo();
    }
    
    // Actualizar lista de ganadores
    actualizarListaGanadores();
}

function actualizarNumeroJugadores() {
    const numJugadoresElement = document.getElementById('numJugadores');
    if (numJugadoresElement && salaActual) {
        numJugadoresElement.textContent = salaActual.jugadores.length;
    }
}

function actualizarListaJugadores() {
    const listaJugadores = document.getElementById('listaJugadores');
    if (!listaJugadores) return;
    
    listaJugadores.innerHTML = '';
    
    salaActual.jugadores.forEach(jugador => {
        const div = document.createElement('div');
        div.className = 'jugador-item';
        if (jugador.id === salaActual.anfitrion) {
            div.classList.add('anfitrion');
        }
        
        div.innerHTML = `
            <div class="avatar">${jugador.nombre.charAt(0).toUpperCase()}</div>
            <div>
                <div style="font-weight: 500;">${jugador.nombre}</div>
                <div style="font-size: 0.8rem; color: #718096;">
                    ${jugador.tablaSeleccionada ? `Tabla ${jugador.tablaSeleccionada.id + 1}` : 'Sin tabla'}
                </div>
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
    // Los números marcados ahora se muestran directamente en la tabla de bingo
    // Solo actualizar la información de depuración
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
            elemento.textContent = celda.numero;
            elemento.style.gridColumn = colIndex + 1;
            elemento.style.gridRow = filaIndex + 2; // +2 porque la fila 1 son los headers
            
            // SOLO marcar si el usuario lo marcó manualmente
            if (numerosMarcados.includes(celda.numero)) {
                elemento.classList.add('marcada');
            }
            
            // Permitir marcar solo si está cantado y no marcado
            elemento.addEventListener('click', () => {
                if (numerosCantados.includes(celda.numero) && !numerosMarcados.includes(celda.numero)) {
                    marcarNumero(celda.numero);
                }
            });
            
            tablaBingo.appendChild(elemento);
        });
    });
    
    // Mostrar información de depuración
    mostrarInfoDepuracion();
}

function actualizarListaGanadores() {
    console.log('🔄 Actualizando lista de ganadores');
    const listaGanadores = document.getElementById('listaGanadores');
    if (!listaGanadores) {
        console.log('❌ Elemento listaGanadores no encontrado');
        return;
    }
    
    if (!salaActual) {
        console.log('❌ salaActual no está definida');
        return;
    }
    
    console.log('📊 Ganadores en sala:', salaActual.ganadores);
    
    listaGanadores.innerHTML = '';
    
    if (salaActual.ganadores && salaActual.ganadores.length > 0) {
        console.log(`✅ Mostrando ${salaActual.ganadores.length} ganadores`);
        salaActual.ganadores.forEach((ganador, index) => {
            console.log(`🏆 Ganador ${index + 1}:`, ganador);
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
    } else {
        console.log('📝 No hay ganadores, mostrando mensaje por defecto');
        listaGanadores.innerHTML = '<div style="text-align: center; color: #718096; padding: 20px;">Aún no hay ganadores</div>';
    }
}

function mostrarModalBingo(ganador) {
    console.log('Mostrando modal de bingo:', ganador);
    const modal = document.getElementById('modalBingo');
    const mensaje = document.getElementById('mensajeBingo');
    const detalles = document.getElementById('detallesBingo');
    
    mensaje.textContent = `¡${ganador.jugador.nombre} ha ganado!`;
    
    // Crear tabla del ganador para mostrar con resaltado del patrón ganado
    let tablaHTML = '';
    if (ganador.jugador.tablaSeleccionada) {
        tablaHTML = `
            <div class="tabla-ganador">
                <h4>Tabla del Ganador:</h4>
                <div class="tabla-bingo-mini">
                    ${ganador.jugador.tablaSeleccionada.numeros.map((fila, filaIndex) => 
                        fila.map((celda, colIndex) => {
                            const esMarcado = ganador.jugador.numerosMarcados.includes(celda.numero);
                            const esGanador = esGanadorEnPatron(ganador.patron, ganador.resultado, filaIndex, colIndex, esMarcado);
                            return `<span class="numero ${esMarcado ? 'marcado' : ''} ${esGanador ? 'ganador' : ''}">${celda.numero}</span>`;
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
            // Resaltar la línea ganadora
            if (resultado.fila && resultado.fila === filaIndex + 1) return true;
            if (resultado.columna && resultado.columna === colIndex + 1) return true;
            if (resultado.diagonal === 'principal' && filaIndex === colIndex) return true;
            if (resultado.diagonal === 'secundaria' && filaIndex + colIndex === 4) return true;
            break;
            
        case 'cuatroEsquinas':
            // Resaltar las cuatro esquinas
            if ((filaIndex === 0 || filaIndex === 4) && (colIndex === 0 || colIndex === 4)) return true;
            break;
            
        case 'loco':
            // Para LOCO, no hay patrón específico, solo marcar los 5 números
            return true;
            
        case 'tablaLlena':
            // Para tabla llena, todos los marcados son ganadores
            return true;
    }
    
    return false;
}

function cerrarModal() {
    document.getElementById('modalBingo').classList.add('oculta');
}

function cerrarModalFinal() {
    document.getElementById('modalFinal').classList.add('oculta');
}

function iniciarNuevaPartida() {
    if (confirm('¿Estás seguro de que quieres iniciar una nueva partida?')) {
        socket.emit('iniciarNuevaPartida', { salaId: salaActual.id });
        mostrarNotificacion('Iniciando nueva partida...', 'info');
    }
}

function iniciarNuevaPartidaDesdeJuego() {
    const modalConfirmacion = document.getElementById('modalConfirmarNuevaPartida');
    modalConfirmacion.classList.remove('oculta');
}

function aceptarNuevaPartida() {
    // Cerrar el modal
    document.getElementById('modalConfirmarNuevaPartida').classList.add('oculta');
    
    // Notificar al servidor que acepta la nueva partida
    socket.emit('aceptarNuevaPartida', { salaId: salaActual.id });
    
    mostrarNotificacion('¡Te has unido a la nueva partida!', 'exito');
}

function rechazarNuevaPartida() {
    // Cerrar el modal
    document.getElementById('modalConfirmarNuevaPartida').classList.add('oculta');
    
    // Notificar al servidor que rechaza la nueva partida
    socket.emit('rechazarNuevaPartida', { salaId: salaActual.id });
    
    mostrarNotificacion('Has rechazado la nueva partida', 'info');
}

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
        const patrones = obtenerPatronesSeleccionados();
        const velocidad = parseInt(document.getElementById('velocidadCanto').value);
        
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
    const notificaciones = document.getElementById('notificaciones');
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo}`;
    notificacion.textContent = mensaje;
    
    notificaciones.appendChild(notificacion);
    
    // Reproducir sonido de notificación
    if (tipo === 'exito') {
        playSuccess();
    } else if (tipo === 'error') {
        playError();
    } else {
        playNotification();
    }
    
    setTimeout(() => {
        notificacion.remove();
    }, 5000);
}

function mostrarModalFinal(mensaje, detalles) {
    const modal = document.getElementById('modalFinal');
    const mensajeModal = document.getElementById('mensajeFinal');
    const detallesModal = document.getElementById('detallesFinal');

    mensajeModal.textContent = mensaje;
    detallesModal.innerHTML = detalles;
    modal.classList.remove('oculta');
}

// Funciones auxiliares
function obtenerPatronesSeleccionados() {
    const patrones = [];
    
    if (document.getElementById('patronLinea').checked) patrones.push('linea');
    if (document.getElementById('patronTablaLlena').checked) patrones.push('tablaLlena');
    if (document.getElementById('patronCuatroEsquinas').checked) patrones.push('cuatroEsquinas');
    if (document.getElementById('patronLoco').checked) patrones.push('loco');
    
    return patrones;
}

function actualizarVelocidad() {
    const velocidad = document.getElementById('velocidadCanto').value;
    const segundos = velocidad / 1000;
    document.getElementById('velocidadTexto').textContent = `${segundos} segundos`;
}

function actualizarVelocidadRapida() {
    const velocidad = document.getElementById('velocidadCantoRapido').value;
    const velocidadTexto = document.getElementById('velocidadTextoRapido');
    velocidadTexto.textContent = `${Math.round(velocidad / 1000)}s`;
}

function obtenerPatronesRapidos() {
    const patrones = [];
    if (document.getElementById('patronLineaRapido').checked) patrones.push('linea');
    if (document.getElementById('patronTablaLlenaRapido').checked) patrones.push('tablaLlena');
    if (document.getElementById('patronCuatroEsquinasRapido').checked) patrones.push('cuatroEsquinas');
    if (document.getElementById('patronLocoRapido').checked) patrones.push('loco');
    return patrones;
}

function iniciarJuegoRapido() {
    // Obtener patrones seleccionados
    const patronesSeleccionados = [];
    document.querySelectorAll('.patrones-rapidos input[type="checkbox"]:checked').forEach(checkbox => {
        patronesSeleccionados.push(checkbox.value);
    });
    
    // Obtener velocidad seleccionada
    const velocidad = document.getElementById('velocidadCantoRapido').value;
    
    // Configurar la sala
    socket.emit('configurarSala', {
        salaId: salaActual.id,
        configuracion: {
            patrones: patronesSeleccionados,
            velocidadCanto: parseInt(velocidad)
        }
    });
    
    // Iniciar el juego
    socket.emit('iniciarJuego', {
        salaId: salaActual.id
    });
    
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
    // Implementar lógica de pausa
    mostrarNotificacion('Función de pausa en desarrollo', 'info');
}

function salirJuego() {
    if (confirm('¿Estás seguro de que quieres salir del juego?')) {
        volverInicio();
    }
}

function manejarTablaSeleccionada(data) {
    tablaSeleccionada = data.tabla;
    
    // Marcar tabla como seleccionada en la UI
    document.querySelectorAll('.tabla-mini').forEach(tabla => {
        tabla.classList.remove('seleccionada');
    });
    
    const tablaElement = document.querySelector(`[data-tabla-id="${data.tabla.id}"]`);
    if (tablaElement) {
        tablaElement.classList.add('seleccionada');
    }
    
    mostrarNotificacion(`Seleccionaste la tabla ${data.tabla.id + 1}`, 'exito');
    
    // Si el juego ya está activo, ir directamente a la pantalla de juego
    if (salaActual.juegoActivo) {
        mostrarPantalla('pantallaJuego');
        inicializarPantallaJuego();
    }
}
