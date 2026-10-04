// =============================== CONFIGURACIÓN ===============================

const ESTADOS = {
    INICIO: "inicio",
    CARGANDO: "cargando",
    TURNO: "turno"
};

// =============================== ELEMENTOS DE LA INTERFAZ ===============================

const botones          = document.querySelectorAll(".botones button");
const contenedorInicio = document.querySelector(".botones");
const pantallaTurno    = document.getElementById("pantallaTurno");
const numeroTurno      = document.getElementById("numeroTurno");
const volverInicio     = document.getElementById("volverInicio");

// =============================== ESTADO ===============================

let estadoActual = ESTADOS.INICIO;

// =============================== FUNCIONES ===============================

/**
 * Realiza una petición al servidor y devuelve la respuesta en formato JSON.
 *
 * Cancela automáticamente la petición si supera el tiempo máximo establecido.
 *
 * @param {string} url Dirección del endpoint.
 * @param {Object} opciones Opciones de la petición.
 * @returns {Promise<Object>} Datos recibidos desde el servidor.
 */
async function fetchJSON(url, opciones = {}) {
    const timeoutMs   = opciones.timeoutMs || 8000;
    const controlador = new AbortController();

    const temporizador = setTimeout(
        () => controlador.abort(),
        timeoutMs
    );

    try {
        const respuesta = await fetch(
            url,
            {
                ...opciones,
                signal: controlador.signal
            }
        );

        let datos = {};

        try {
            datos = await respuesta.json();
        } catch (error) {
            console.warn("La respuesta no tenía JSON válido:", error);
        }

        if (!respuesta.ok) throw new Error(datos.error || "Error del servidor");

        return datos;
    } finally {
        clearTimeout(temporizador);
    }
}

/**
 * Actualiza el estado actual del turnero y la interfaz correspondiente.
 *
 * @param {string} nuevoEstado Estado al que se desea cambiar.
 */
function actualizarEstado(nuevoEstado) {
    estadoActual = nuevoEstado;

    if (nuevoEstado === ESTADOS.TURNO) {
        contenedorInicio.style.display = "none";
        pantallaTurno.style.display = "block";

        return;
    }

    if (nuevoEstado === ESTADOS.CARGANDO) return;

    pantallaTurno.style.display    = "none";
    contenedorInicio.style.display = "flex";
}

/**
 * Restaura un botón a su estado original.
 *
 * @param {HTMLElement} boton Botón que se desea restaurar.
 */
function prepararBoton(boton) {
    boton.disabled = false;

    boton.classList.remove("boton--loading");

    const contenidoOriginal = boton.dataset.originalContent || boton.innerHTML;

    boton.innerHTML = contenidoOriginal;
}

/**
 * Muestra el estado de carga de un botón.
 *
 * @param {HTMLElement} boton Botón que está generando el turno.
 */
function mostrarCarga(boton) {
    boton.dataset.originalContent = boton.innerHTML;

    boton.innerHTML = `
        <span>Generando turno...</span>
        <span class="traduccion">Generating ticket...</span>
    `;

    boton.disabled = true;

    boton.classList.add("boton--loading");
}

/**
 * Solicita al servidor la generación de un nuevo turno.
 *
 * @param {string} tipo Tipo de turno que se desea generar.
 * @returns {Promise<Object>} Datos del turno generado.
 */
async function generarTurno(tipo) {
    return fetchJSON(
        "/api/turnos",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                tipo
            })
        }
    );
}

/**
 * Muestra el número de turno generado.
 *
 * @param {Object} datos Datos recibidos del servidor.
 */
function mostrarTurno(datos) {
    numeroTurno.textContent = datos.turno;

    actualizarEstado(ESTADOS.TURNO);
}

/**
 * Regresa la interfaz a la pantalla inicial.
 */
function volverAlInicio() {
    actualizarEstado(ESTADOS.INICIO);

    botones.forEach((boton) => {
        prepararBoton(boton);
    });

    const primerBoton = document.querySelector(".boton[data-tipo='R']");

    if (primerBoton) primerBoton.focus();
}

/**
 * Maneja la selección de un tipo de turno.
 *
 * @param {Event} evento Evento generado por el botón.
 */
async function manejarClick(evento) {
    const boton = evento.currentTarget;

    if (boton.disabled || estadoActual === ESTADOS.CARGANDO) return;

    const tipo = boton.dataset.tipo;

    if (!tipo) return;

    actualizarEstado(ESTADOS.CARGANDO);

    mostrarCarga(boton);

    try {
        const datos = await generarTurno(tipo);

        console.log(
            "Turno generado:",
            datos
        );

        mostrarTurno(datos);
    } catch (error) {
        console.error("Error:", error);

        alert(error.message || "No fue posible generar el turno.");

        prepararBoton(boton);

        actualizarEstado(ESTADOS.INICIO);
    }
}

// =============================== INICIALIZACIÓN ===============================

/**
 * Inicializa el turnero.
 */
function iniciar() {
    botones.forEach((boton) => {
        boton.addEventListener("click", manejarClick);
    });

    volverInicio.addEventListener("click", volverAlInicio);

    numeroTurno.setAttribute("aria-live", "polite");
}

iniciar();
