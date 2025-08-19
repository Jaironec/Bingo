
// Aggregación de múltiples premios simultáneos en el modal de Bingo
(function() {
	const AGG_DELAY_MS = 300;
	const bufferPorJugadorYNumero = new Map(); // key: `${jugadorId}:${numero}` -> { lista: [], timeoutId }

	function renderModalMultiple(listaGanadores) {
		if (!listaGanadores || listaGanadores.length === 0) return;
		const g = listaGanadores[0];
		const modal = document.getElementById('modalBingo');
		const mensaje = document.getElementById('mensajeBingo');
		const detalles = document.getElementById('detallesBingo');
		if (!modal || !mensaje || !detalles) return;

		mensaje.textContent = `¡${g.jugador.nombre} ha ganado!`;

		let tablaHTML = '';
		if (g.jugador.tablaSeleccionada) {
			tablaHTML = `
				<div class="tabla-ganador">
					<h4>Tabla del Ganador:</h4>
					<div class="tabla-bingo-mini">
						${g.jugador.tablaSeleccionada.numeros.map((fila, filaIndex) => 
							fila.map((celda, colIndex) => {
								const esMarcado = g.jugador.numerosMarcados.includes(celda.numero) || celda.esLibre;
								const esGanador = (typeof esGanadorEnPatron === 'function') && esGanadorEnPatron(g.patron, g.resultado, filaIndex, colIndex, esMarcado);
								const base = celda.esLibre ? '<span class="numero free"><i class="fas fa-star"></i>' : `<span class="numero${esGanador ? ' ganador' : ''}">${celda.numero}`;
								return `${base}</span>`;
							}).join('')
						).join('')}
					</div>
				</div>
			`;
		}

		if (listaGanadores.length > 1) {
			const patrones = Array.from(new Set(listaGanadores.map(x => x.resultado?.tipo || x.patron)));
			const numeros = Array.from(new Set(listaGanadores.map(x => x.numeroGanador)));
			detalles.innerHTML = `
				<p><strong>Patrones ganados:</strong></p>
				<ul>${patrones.map(p => `<li>${p}</li>`).join('')}</ul>
				<p><strong>${numeros.length > 1 ? 'Números ganadores' : 'Número ganador'}:</strong> ${numeros.join(', ')}</p>
				${tablaHTML}
			`;
		} else {
			detalles.innerHTML = `
				<p><strong>Patrón:</strong> ${g.resultado?.tipo || g.patron}</p>
				<p><strong>Número ganador:</strong> ${g.numeroGanador}</p>
				${tablaHTML}
			`;
		}

		modal.classList.remove('oculta');
	}

	// Sobrescribir mostrarModalBingo para agregar un pequeño buffer y agrupar
	window.mostrarModalBingo = function(ganador) {
		if (!ganador || !ganador.jugador) return;
		const jugadorId = ganador.jugador.id;
		const numero = ganador.numeroGanador;
		const key = `${jugadorId}:${numero}`;
		let entry = bufferPorJugadorYNumero.get(key);
		if (!entry) {
			entry = { lista: [], timeoutId: null };
			bufferPorJugadorYNumero.set(key, entry);
		}
		entry.lista.push(ganador);
		if (entry.timeoutId) clearTimeout(entry.timeoutId);
		entry.timeoutId = setTimeout(() => {
			try { renderModalMultiple(entry.lista); } finally { bufferPorJugadorYNumero.delete(key); }
		}, AGG_DELAY_MS);
	};
})();