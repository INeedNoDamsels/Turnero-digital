const numeroDestacado = document.getElementById("numeroDestacado");
const ubicacionDestacada = document.getElementById("ubicacionDestacada");
const listaLlamados = document.getElementById("listaLlamados");

const POLLING_INTERVAL = 3000;
const TIEMPO_TRANSICION = 5000;
const MAX_TURNOS_VISIBLES = 6;

let idsConocidos = new Set();
let primeraCarga = true;
let turnoDestacado = null;
let colaDestacados = [];
let historialLlamados = [];
let temporizadorTransicion = null;
let contextoAudio = null;

async function fetchJSON(url, opciones = {}) {
    const tiempoLimite = opciones.timeoutMs || 8000;
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), tiempoLimite);

    try {
        const respuesta = await fetch(url, {
            ...opciones,
            signal: controlador.signal,
            cache: "no-store"
        });

        let datos = [];

        try {
            datos = await respuesta.json();
        } catch (error) {
            console.warn("La respuesta no tenía JSON válido:", error);
        }

        if (!respuesta.ok) {
            const mensaje = datos.error || "No fue posible obtener los datos";
            throw new Error(mensaje);
        }

        return Array.isArray(datos) ? datos : datos.data || [];
    } finally {
        clearTimeout(temporizador);
    }
}

async function obtenerTurnosLlamados() {
    return fetchJSON("/api/turnos/llamados");
}

function formatearTurno(turno) {
    return turno.turno || `${turno.tipo}-${String(turno.numero).padStart(3, "0")}`;
}

function obtenerMomentoLlamado(turno) {
    const fecha = turno.fecha_llamado || turno.fecha || "";
    const hora = turno.hora_llamado || turno.hora || "";

    return `${fecha} ${hora}`;
}

function compararTurnos(a, b) {
    const momentoA = obtenerMomentoLlamado(a);
    const momentoB = obtenerMomentoLlamado(b);

    if (momentoA !== momentoB) {
        return momentoA.localeCompare(momentoB);
    }

    return a.id - b.id;
}

function reproducirSonido() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;

        if (!AudioContext) {
            return;
        }

        if (!contextoAudio) {
            contextoAudio = new AudioContext();
        }

        contextoAudio.resume();

        const oscilador = contextoAudio.createOscillator();
        const ganancia = contextoAudio.createGain();

        oscilador.type = "sine";
        oscilador.frequency.setValueAtTime(880, contextoAudio.currentTime);
        oscilador.frequency.setValueAtTime(660, contextoAudio.currentTime + 0.18);

        ganancia.gain.setValueAtTime(0.001, contextoAudio.currentTime);
        ganancia.gain.exponentialRampToValueAtTime(
            0.3,
            contextoAudio.currentTime + 0.03
        );
        ganancia.gain.exponentialRampToValueAtTime(
            0.001,
            contextoAudio.currentTime + 0.5
        );

        oscilador.connect(ganancia);
        ganancia.connect(contextoAudio.destination);

        oscilador.start();
        oscilador.stop(contextoAudio.currentTime + 0.5);
    } catch (error) {
        console.error("No se pudo reproducir el sonido:", error);
    }
}

function mostrarDestacado(turno) {
    if (!turno) {
        numeroDestacado.textContent = "-";
        ubicacionDestacada.textContent = "Esperando llamado";
        return;
    }

    numeroDestacado.textContent = formatearTurno(turno);
    ubicacionDestacada.textContent = `PISO ${turno.piso} - PC ${turno.puesto}`;
}

function crearElementoTurno(turno) {
    const elemento = document.createElement("div");
    elemento.className = "turno";

    elemento.innerHTML = `
        <div class="numero">${formatearTurno(turno)}</div>
        <div class="ubicacion">PISO ${turno.piso} - PC ${turno.puesto}</div>
    `;

    return elemento;
}

function obtenerIdsActuales(turnos) {
    return new Set(turnos.map((turno) => turno.id));
}

function limpiarCola(turnos) {
    const idsActuales = obtenerIdsActuales(turnos);

    colaDestacados = colaDestacados.filter((turno) =>
        idsActuales.has(turno.id)
    );

    if (
        colaDestacados.length === 0 &&
        temporizadorTransicion
    ) {
        clearTimeout(temporizadorTransicion);
        temporizadorTransicion = null;
    }
}

function actualizarHistorial(turnos) {
    const idsActuales = obtenerIdsActuales(turnos);

    historialLlamados = historialLlamados.filter((turno) =>
        idsActuales.has(turno.id)
    );

    if (
        turnoDestacado &&
        idsActuales.has(turnoDestacado.id)
    ) {
        historialLlamados = historialLlamados.filter(
            (turno) => turno.id !== turnoDestacado.id
        );
    }

    historialLlamados = historialLlamados.filter(
        (turno) =>
            !colaDestacados.some(
                (pendiente) => pendiente.id === turno.id
            )
    );
}

function mostrarLlamados() {
    listaLlamados.innerHTML = "";

    const turnosVisibles = historialLlamados
        .filter((turno) => {
            if (
                turnoDestacado &&
                turno.id === turnoDestacado.id
            ) {
                return false;
            }

            if (
                colaDestacados.some(
                    (pendiente) => pendiente.id === turno.id
                )
            ) {
                return false;
            }

            return true;
        })
        .sort((a, b) => compararTurnos(b, a))
        .slice(0, MAX_TURNOS_VISIBLES);

    if (turnosVisibles.length === 0) {
        listaLlamados.innerHTML = `
            <div class="sin-llamados">
                No hay otros turnos llamados
            </div>
        `;
        return;
    }

    turnosVisibles.forEach((turno) => {
        listaLlamados.appendChild(crearElementoTurno(turno));
    });
}

function agregarAlHistorial(turno) {
    if (!turno) {
        return;
    }

    const yaExiste = historialLlamados.some(
        (item) => item.id === turno.id
    );

    if (!yaExiste) {
        historialLlamados.push(turno);
    }
}

function agregarACola(turnos) {
    turnos
        .sort(compararTurnos)
        .forEach((turno) => {
            const yaEnCola = colaDestacados.some(
                (item) => item.id === turno.id
            );

            const yaDestacado =
                turnoDestacado &&
                turnoDestacado.id === turno.id;

            const yaEnHistorial = historialLlamados.some(
                (item) => item.id === turno.id
            );

            if (
                !yaEnCola &&
                !yaDestacado &&
                !yaEnHistorial
            ) {
                colaDestacados.push(turno);
            }
        });
}

function programarSiguienteDestacado() {
    if (
        !turnoDestacado ||
        colaDestacados.length === 0 ||
        temporizadorTransicion
    ) {
        return;
    }

    temporizadorTransicion = setTimeout(() => {
        temporizadorTransicion = null;
        avanzarDestacado();
    }, TIEMPO_TRANSICION);
}

function avanzarDestacado() {
    if (colaDestacados.length === 0) {
        return;
    }

    if (turnoDestacado) {
        agregarAlHistorial(turnoDestacado);
    }

    const siguiente = colaDestacados.shift();

    turnoDestacado = siguiente;

    mostrarDestacado(turnoDestacado);
    reproducirSonido();

    mostrarLlamados();

    if (colaDestacados.length > 0) {
        programarSiguienteDestacado();
    }
}

function inicializarPantalla(turnos) {
    if (turnos.length === 0) {
        turnoDestacado = null;
        historialLlamados = [];
        mostrarDestacado(null);
        mostrarLlamados();
        return;
    }

    const ordenados = [...turnos].sort(compararTurnos);

    turnoDestacado = ordenados[ordenados.length - 1];

    historialLlamados = ordenados
        .filter((turno) => turno.id !== turnoDestacado.id)
        .reverse();

    mostrarDestacado(turnoDestacado);
    mostrarLlamados();
}

function obtenerNuevosTurnos(turnos) {
    const idsActuales = obtenerIdsActuales(turnos);

    if (primeraCarga) {
        primeraCarga = false;
        idsConocidos = idsActuales;
        return [];
    }

    const nuevos = turnos.filter(
        (turno) => !idsConocidos.has(turno.id)
    );

    idsConocidos = idsActuales;

    return nuevos.sort(compararTurnos);
}

async function cargarTurnos() {
    try {
        const turnos = await obtenerTurnosLlamados();
        const idsActuales = obtenerIdsActuales(turnos);

        if (primeraCarga) {
            idsConocidos = idsActuales;
            primeraCarga = false;

            inicializarPantalla(turnos);
            return;
        }

        limpiarCola(turnos);

        const destacadoSigueActivo =
            turnoDestacado &&
            idsActuales.has(turnoDestacado.id);

        if (turnoDestacado && !destacadoSigueActivo) {
            turnoDestacado = null;
            mostrarDestacado(null);
        }

        actualizarHistorial(turnos);

        const nuevos = obtenerNuevosTurnos(turnos);

        if (nuevos.length > 0) {
            agregarACola(nuevos);
        }

        if (!turnoDestacado && colaDestacados.length > 0) {
            avanzarDestacado();
        } else if (
            turnoDestacado &&
            colaDestacados.length > 0
        ) {
            programarSiguienteDestacado();
        }

        idsConocidos = idsActuales;

        actualizarHistorial(turnos);
        mostrarLlamados();
    } catch (error) {
        console.error("Error al cargar turnos:", error);
    }
}

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        cargarTurnos();
    }
});

cargarTurnos();
setInterval(cargarTurnos, POLLING_INTERVAL);
