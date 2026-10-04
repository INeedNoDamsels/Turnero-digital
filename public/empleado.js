// =============================== CONFIGURACIÓN ===============================

const parametros = new URLSearchParams(window.location.search);

const pisoSeleccionado   = Number(parametros.get("piso"));
const puestoSeleccionado = Number(parametros.get("puesto"));

const puestosPorPiso = {
    1: [1, 2],
    2: [1, 2, 3]
};

// =============================== ELEMENTOS DE LA INTERFAZ ===============================

const listaReservas  = document.getElementById("listaReservas");
const listaConsultas = document.getElementById("listaCotizaciones");
const numeroActual   = document.getElementById("numeroActual");
const pisoActual     = document.getElementById("pisoActual");
const botonFinalizar = document.getElementById("finalizar");
const titulo         = document.querySelector("h1");

// =============================== ESTADO ===============================

/**
 * Turno que se encuentra actualmente siendo atendido por este puesto.
 *
 * @type {Object|null}
 */
let turnoActual = null;

// =============================== FUNCIONES ===============================

/**
 * Valida que el piso y puesto seleccionados sean válidos.
 *
 * @throws {Error} Si el piso o puesto no son válidos.
 */
function validarPuesto() {
    const puestosPermitidos = puestosPorPiso[pisoSeleccionado];

    if (!puestosPermitidos) throw new Error("Piso inválido");

    if (!puestosPermitidos.includes(puestoSeleccionado)) throw new Error("Puesto inválido");
}

/**
 * Configura la interfaz del empleado con el piso y puesto seleccionados.
 */
function configurarInterfaz() {
    titulo.textContent =
        `Piso ${pisoSeleccionado} - PC ${puestoSeleccionado}`;

    pisoActual.textContent =
        `Piso ${pisoSeleccionado} - PC ${puestoSeleccionado}`;
}

/**
 * Obtiene la lista de turnos que están esperando ser atendidos.
 *
 * @returns {Promise<Array>} Una promesa que se resuelve con los turnos.
 */
async function obtenerTurnos() {
    const respuesta = await fetch(
        "/api/turnos/esperando",
        {
            cache: "no-store"
        }
    );

    if (!respuesta.ok) throw new Error("No fue posible obtener los turnos");

    return await respuesta.json();
}

/**
 * Crea un elemento HTML para representar un turno.
 *
 * @param {Object} turno Turno que se mostrará.
 * @returns {HTMLElement} Elemento HTML del turno.
 */
function crearElementoTurno(turno) {
    const elemento = document.createElement("div");

    elemento.className = "turno";

    elemento.innerHTML = `
        <span class="numero">${turno.turno}</span>
        <button class="boton-llamar">LLAMAR</button>
    `;

    const boton = elemento.querySelector(".boton-llamar");

    boton.addEventListener("click", () => {
        llamarTurno(turno.id);
    });

    return elemento;
}

/**
 * Muestra la lista de turnos en la interfaz.
 *
 * Separa los turnos entre reservas y consultas.
 *
 * @param {Array} turnos Lista de turnos recibida desde el servidor.
 */
function mostrarTurnos(turnos) {
    listaReservas.innerHTML  = "";
    listaConsultas.innerHTML = "";

    const reservas = turnos.filter((turno) => turno.tipo === "R");
    const consultas = turnos.filter((turno) => turno.tipo === "C");

    // =============================== RESERVAS ===============================

    if (reservas.length === 0) {
        listaReservas.innerHTML =
            '<div class="sin-turnos">No hay turnos esperando</div>';
    } else {
        reservas.forEach((turno) => {
            listaReservas.appendChild(crearElementoTurno(turno));
        });
    }

    // =============================== CONSULTAS ===============================

    if (consultas.length === 0) {
        listaConsultas.innerHTML =
            '<div class="sin-turnos">No hay turnos esperando</div>';
    } else {
        consultas.forEach((turno) => {
            listaConsultas.appendChild(crearElementoTurno(turno));
        });
    }
}

/**
 * Carga la lista de turnos desde el servidor y los muestra en la interfaz.
 */
async function cargarTurnos() {
    try {
        const turnos = await obtenerTurnos();
        mostrarTurnos(turnos);
    } catch (error) {
        console.error(error);
    }
}

/**
 * Llama a un turno específico.
 *
 * @param {number} id ID del turno.
 * @returns {Promise<void>}
 */
async function llamarTurno(id) {
    if (turnoActual) {
        alert("Este puesto ya está atendiendo un turno.");
        return;
    }

    try {
        const respuesta = await fetch(
            `/api/turnos/${id}/llamar`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    piso: pisoSeleccionado,
                    puesto: puestoSeleccionado
                })
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) throw new Error(datos.error || "No fue posible llamar el turno");

        turnoActual = datos;

        numeroActual.textContent = datos.turno;

        pisoActual.textContent =
            `Piso ${datos.piso} - PC ${datos.puesto}`;

        botonFinalizar.disabled = false;

        await cargarTurnos();

    } catch (error) {
        alert(error.message);
        await cargarTurnos();
    }
}

/**
 * Finaliza el turno actualmente atendido.
 *
 * @returns {Promise<void>}
 */
async function finalizarTurno() {
    if (!turnoActual) return;

    try {
        const respuesta = await fetch(
            `/api/turnos/${turnoActual.id}/finalizar`,
            {
                method: "POST"
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) throw new Error(datos.error || "No fue posible finalizar el turno");

        turnoActual = null;

        numeroActual.textContent = "-";

        pisoActual.textContent =
            `Piso ${pisoSeleccionado} - PC ${puestoSeleccionado}`;

        botonFinalizar.disabled = true;

        await cargarTurnos();

    } catch (error) {
        alert(error.message);
    }
}

/**
 * Actualiza periódicamente la lista de turnos.
 *
 * Espera a que termine una actualización antes de iniciar
 * la siguiente para evitar solicitudes simultáneas.
 */
async function actualizarPeriodicamente() {
    await cargarTurnos();

    setTimeout(actualizarPeriodicamente, 2000);
}

// =============================== INICIALIZACIÓN ===============================

/**
 * Inicializa el panel del empleado.
 */
function iniciar() {
    validarPuesto();

    configurarInterfaz();

    botonFinalizar.addEventListener(
        "click",
        finalizarTurno
    );

    actualizarPeriodicamente();
}

iniciar();
