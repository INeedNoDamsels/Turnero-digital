// =============================== CONFIGURACIÓN ===============================

const POLLING_INTERVAL       = 3000;
const TIEMPO_TRANSICION      = 5000;
const MAX_TURNOS_VISIBLES    = 6;
const TIEMPO_LIMITE_PETICION = 8000;

// =============================== ELEMENTOS DE LA INTERFAZ ===============================

const numeroDestacado    = document.getElementById("numeroDestacado");
const ubicacionDestacada = document.getElementById("ubicacionDestacada");
const listaLlamados      = document.getElementById("listaLlamados");

// =============================== ESTADO ===============================

let idsConocidos           = new Set();
let primeraCarga           = true;
let turnoDestacado         = null;
let colaDestacados         = [];
let historialLlamados      = [];
let temporizadorTransicion = null;
let contextoAudio          = null;

// =============================== FUNCIONES ===============================

/**
 * Realiza una petición al servidor y devuelve la respuesta en formato JSON.
 *
 * Cancela automáticamente la petición si supera el tiempo máximo establecido.
 *
 * @param {string} url Dirección del endpoint.
 * @param {Object} opciones Opciones de la petición.
 * @returns {Promise<Array>} Datos recibidos desde el servidor.
 */
async function fetchJSON(url, opciones = {}) {
    const tiempoLimite = opciones.timeoutMs || TIEMPO_LIMITE_PETICION;

    const controlador = new AbortController();

    const temporizador = setTimeout(() => controlador.abort(), tiempoLimite);

    try {
        const respuesta = await fetch(
            url,
            {
                ...opciones,
                signal: controlador.signal,
                cache: "no-store"
            }
        );

        let datos = [];

        try {
            datos = await respuesta.json();
        } catch (error) {
            console.warn("La respuesta no tenía JSON válido:", error);
        }

        if (!respuesta.ok) throw new Error(datos.error || "No fue posible obtener los datos");

        return Array.isArray(datos) ? datos : datos.data || [];
    } finally {
        clearTimeout(temporizador);
    }
}

/**
 * Obtiene los turnos que fueron llamados.
 *
 * @returns {Promise<Array>} Lista de turnos llamados.
 */
async function obtenerTurnosLlamados() {
    return fetchJSON("/api/turnos/llamados");
}

/**
 * Obtiene el número que debe mostrarse para un turno.
 *
 * @param {Object} turno Turno a formatear.
 * @returns {string} Número formateado del turno.
 */
function formatearTurno(turno) {
    return turno.turno || `${turno.tipo}-${String(turno.numero).padStart(3, "0")}`;
}

/**
 * Obtiene la fecha y hora asociadas al llamado de un turno.
 *
 * @param {Object} turno Turno del que se desea obtener el momento.
 * @returns {string} Fecha y hora del llamado.
 */
function obtenerMomentoLlamado(turno) {
    const fecha =
        turno.fecha_llamado ||
        turno.fecha ||
        "";

    const hora =
        turno.hora_llamado ||
        turno.hora ||
        "";

    return `${fecha} ${hora}`;
}

/**
 * Compara dos turnos según el momento en que fueron llamados.
 *
 * Si ambos tienen el mismo momento, utiliza el ID como desempate.
 *
 * @param {Object} a Primer turno.
 * @param {Object} b Segundo turno.
 * @returns {number} Resultado de la comparación.
 */
function compararTurnos(a, b) {
    const momentoA = obtenerMomentoLlamado(a);

    const momentoB = obtenerMomentoLlamado(b);

    if (momentoA !== momentoB) return momentoA.localeCompare(momentoB);

    return a.id - b.id;
}

/**
 * Reproduce el sonido utilizado para anunciar un nuevo turno.
 */
function reproducirSonido() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;

        if (!AudioContext) return;

        if (!contextoAudio) contextoAudio = new AudioContext();

        contextoAudio.resume();

        const oscilador = contextoAudio.createOscillator();
        const ganancia  = contextoAudio.createGain();

        oscilador.type = "sine";

        oscilador.frequency.setValueAtTime(880, contextoAudio.currentTime);
        oscilador.frequency.setValueAtTime(660, contextoAudio.currentTime + 0.18);

        ganancia.gain.setValueAtTime(0.001, contextoAudio.currentTime);

        ganancia.gain.exponentialRampToValueAtTime(0.3, contextoAudio.currentTime + 0.03);
        ganancia.gain.exponentialRampToValueAtTime(0.001, contextoAudio.currentTime + 0.5);

        oscilador.connect(ganancia);

        ganancia.connect(contextoAudio.destination);

        oscilador.start();

        oscilador.stop(contextoAudio.currentTime + 0.5);

    } catch (error) {
        console.error("No se pudo reproducir el sonido:", error);
    }
}

/**
 * Muestra el turno actualmente destacado.
 *
 * @param {Object|null} turno Turno que se desea destacar.
 */
function mostrarDestacado(turno) {
    if (!turno) {
        numeroDestacado.textContent    = "-";
        ubicacionDestacada.textContent = "Esperando llamado";

        return;
    }

    numeroDestacado.textContent    = formatearTurno(turno);
    ubicacionDestacada.textContent = `PISO ${turno.piso} - PC ${turno.puesto}`;
}

/**
 * Crea un elemento HTML para representar un turno llamado.
 *
 * @param {Object} turno Turno que se desea mostrar.
 * @returns {HTMLElement} Elemento HTML del turno.
 */
function crearElementoTurno(turno) {
    const elemento = document.createElement("div");

    elemento.className = "turno";

    elemento.innerHTML = `
        <div class="numero">
            ${formatearTurno(turno)}
        </div>

        <div class="ubicacion">
            PISO ${turno.piso} - PC ${turno.puesto}
        </div>
    `;

    return elemento;
}

/**
 * Obtiene un conjunto con los IDs de los turnos recibidos.
 *
 * @param {Array} turnos Lista de turnos.
 * @returns {Set} IDs de los turnos.
 */
function obtenerIdsActuales(turnos) {
    return new Set(turnos.map((turno) => turno.id));
}

/**
 * Elimina de la cola los turnos que ya no existen en el servidor.
 *
 * @param {Array} turnos Lista actual de turnos.
 */
function limpiarCola(turnos) {
    const idsActuales = obtenerIdsActuales(turnos);

    colaDestacados = colaDestacados.filter((turno) =>
            idsActuales.has(turno.id)
        );

    if (colaDestacados.length === 0 && temporizadorTransicion) {
        clearTimeout(temporizadorTransicion);

        temporizadorTransicion = null;
    }
}

/**
 * Actualiza el historial de turnos llamados.
 *
 * Elimina los turnos que ya no existen y evita duplicar
 * el turno actualmente destacado o los que están en cola.
 *
 * @param {Array} turnos Lista actual de turnos.
 */
function actualizarHistorial(turnos) {
    const idsActuales = obtenerIdsActuales(turnos);

    historialLlamados = historialLlamados.filter((turno) =>
            idsActuales.has(turno.id)
        );

    if (turnoDestacado && idsActuales.has(turnoDestacado.id)) {
        historialLlamados = historialLlamados.filter(
            (turno) => turno.id !== turnoDestacado.id
        );
    }

    historialLlamados = historialLlamados.filter(
        (turno) => !colaDestacados.some((pendiente) => pendiente.id === turno.id)
    );
}

/**
 * Muestra los turnos llamados anteriormente.
 */
function mostrarLlamados() { listaLlamados.innerHTML = "";

    const turnosVisibles = historialLlamados
            .filter((turno) => {
                if (turnoDestacado && turno.id === turnoDestacado.id) return false;

                if (colaDestacados.some((pendiente) => pendiente.id === turno.id)) return false;

                return true;
            }).sort((a, b) => compararTurnos(b, a)).slice(0, MAX_TURNOS_VISIBLES);


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


/**
 * Agrega un turno al historial si todavía no existe.
 *
 * @param {Object|null} turno Turno que se desea agregar.
 */
function agregarAlHistorial(turno) {
    if (!turno) return;

    const yaExiste = historialLlamados.some((item) => item.id === turno.id);

    if (!yaExiste) historialLlamados.push(turno);
}

/**
 * Agrega nuevos turnos a la cola de destacados.
 *
 * @param {Array} turnos Turnos nuevos recibidos.
 */
function agregarACola(turnos) {
    turnos
        .sort(compararTurnos)
        .forEach((turno) => {

            const yaEnCola = colaDestacados.some((item) => item.id === turno.id);

            const yaDestacado = turnoDestacado && turnoDestacado.id === turno.id;

            const yaEnHistorial = historialLlamados.some((item) => item.id === turno.id);

            if (!yaEnCola && !yaDestacado && !yaEnHistorial) colaDestacados.push(turno);
        });
}

/**
 * Programa la transición hacia el siguiente turno destacado.
 */
function programarSiguienteDestacado() {
    if (!turnoDestacado || colaDestacados.length === 0 || temporizadorTransicion) return;

    temporizadorTransicion = setTimeout(
        () => {
            temporizadorTransicion = null;
            avanzarDestacado();

        }, TIEMPO_TRANSICION
    );
}

/**
 * Avanza hacia el siguiente turno de la cola.
 */
function avanzarDestacado() {
    if (colaDestacados.length === 0) return;

    if (turnoDestacado) agregarAlHistorial(turnoDestacado);

    const siguiente = colaDestacados.shift();

    turnoDestacado = siguiente;

    mostrarDestacado(turnoDestacado);

    reproducirSonido();

    mostrarLlamados();

    if (colaDestacados.length > 0) programarSiguienteDestacado();
}

/**
 * Inicializa la pantalla con los turnos existentes.
 *
 * @param {Array} turnos Lista de turnos llamados.
 */
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

    historialLlamados = ordenados .filter((turno) => turno.id !== turnoDestacado.id).reverse();

    mostrarDestacado(turnoDestacado);

    mostrarLlamados();
}

/**
 * Obtiene los turnos que no estaban presentes en la consulta anterior.
 *
 * @param {Array} turnos Lista actual de turnos.
 * @returns {Array} Turnos nuevos.
 */
function obtenerNuevosTurnos(turnos) {
    const idsActuales = obtenerIdsActuales(turnos);

    if (primeraCarga) {
        primeraCarga = false;

        idsConocidos = idsActuales;

        return [];
    }

    const nuevos = turnos.filter( (turno) => !idsConocidos.has(turno.id));

    idsConocidos = idsActuales;

    return nuevos.sort(compararTurnos);
}

/**
 * Carga los turnos llamados y actualiza la pantalla.
 */
async function cargarTurnos() {
    try {
        const turnos = await obtenerTurnosLlamados();

        const idsActuales = obtenerIdsActuales(turnos);

        // =============================== PRIMERA CARGA ===============================

        if (primeraCarga) {
            idsConocidos = idsActuales;
            primeraCarga = false;

            inicializarPantalla(turnos);

            return;
        }

        // =============================== ACTUALIZACIÓN ===============================

        limpiarCola(turnos);

        const destacadoSigueActivo = turnoDestacado && idsActuales.has(turnoDestacado.id);

        if (turnoDestacado && !destacadoSigueActivo) {
            turnoDestacado = null;

            mostrarDestacado(null);
        }

        actualizarHistorial(turnos);

        const nuevos = obtenerNuevosTurnos(turnos);

        if (nuevos.length > 0) agregarACola(nuevos);

        if (!turnoDestacado && colaDestacados.length > 0) {
            avanzarDestacado();

        } else if (turnoDestacado && colaDestacados.length > 0) {
            programarSiguienteDestacado();
        }

        idsConocidos = idsActuales;

        mostrarLlamados();

    } catch (error) {
        console.error(            "Error al cargar turnos:", error);
    }
}

// =============================== ACTUALIZACIÓN AUTOMÁTICA ===============================

/**
 * Actualiza periódicamente los turnos.
 *
 * Espera a que termine una actualización antes de iniciar
 * la siguiente para evitar solicitudes simultáneas.
 */
async function actualizarPeriodicamente() {
    await cargarTurnos();

    setTimeout(actualizarPeriodicamente, POLLING_INTERVAL);
}


/**
 * Actualiza la pantalla inmediatamente cuando vuelve
 * a estar visible.
 */
function configurarVisibilidad() {
    document.addEventListener(
        "visibilitychange",
        () => {
            if (!document.hidden) cargarTurnos();
        }
    );
}

// =============================== INICIALIZACIÓN ===============================

/**
 * Inicializa la pantalla pública de llamados.
 */
function iniciar() {
    numeroDestacado.setAttribute(
        "aria-live",
        "polite"
    );

    configurarVisibilidad();

    actualizarPeriodicamente();
}

iniciar();
