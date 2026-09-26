const parametros = new URLSearchParams(window.location.search);

const pisoSeleccionado =
    Number(parametros.get("piso"));

const puestoSeleccionado =
    Number(parametros.get("puesto"));

let turnoActual = null;

const listaReservas =
    document.getElementById("listaReservas");

const listaCotizaciones =
    document.getElementById("listaCotizaciones");

const numeroActual =
    document.getElementById("numeroActual");

const pisoActual =
    document.getElementById("pisoActual");

const botonFinalizar =
    document.getElementById("finalizar");

const titulo =
    document.querySelector("h1");

function validarPuesto() {
    if (
        pisoSeleccionado !== 1 &&
        pisoSeleccionado !== 2
    ) {
        throw new Error("Piso inválido");
    }

    const puestosPermitidos =
        pisoSeleccionado === 1
            ? [1, 2]
            : [1, 2, 3];

    if (!puestosPermitidos.includes(puestoSeleccionado)) {
        throw new Error("Puesto inválido");
    }
}

function configurarInterfaz() {
    titulo.textContent =
        `Piso ${pisoSeleccionado} - PC ${puestoSeleccionado}`;
}

async function obtenerTurnos() {
    const respuesta = await fetch(
        "/api/turnos/esperando",
        {
            cache: "no-store"
        }
    );

    if (!respuesta.ok) {
        throw new Error(
            "No fue posible obtener los turnos"
        );
    }

    return await respuesta.json();
}

function crearElementoTurno(turno) {
    const elemento =
        document.createElement("div");

    elemento.className = "turno";

    elemento.innerHTML = `
        <span class="numero">${turno.turno}</span>
        <button class="boton-llamar">LLAMAR</button>
    `;

    const boton =
        elemento.querySelector(".boton-llamar");

    boton.addEventListener(
        "click",
        () => {
            llamarTurno(turno.id);
        }
    );

    return elemento;
}

function mostrarTurnos(turnos) {
    listaReservas.innerHTML = "";
    listaCotizaciones.innerHTML = "";

    const reservas =
        turnos.filter(
            (turno) => turno.tipo === "R"
        );

    const cotizaciones =
        turnos.filter(
            (turno) => turno.tipo === "C"
        );

    if (reservas.length === 0) {
        listaReservas.innerHTML =
            '<div class="sin-turnos">No hay turnos esperando</div>';
    } else {
        reservas.forEach(
            (turno) => {
                listaReservas.appendChild(
                    crearElementoTurno(turno)
                );
            }
        );
    }

    if (cotizaciones.length === 0) {
        listaCotizaciones.innerHTML =
            '<div class="sin-turnos">No hay turnos esperando</div>';
    } else {
        cotizaciones.forEach(
            (turno) => {
                listaCotizaciones.appendChild(
                    crearElementoTurno(turno)
                );
            }
        );
    }
}

async function cargarTurnos() {
    try {
        const turnos =
            await obtenerTurnos();

        mostrarTurnos(turnos);
    } catch (error) {
        console.error(error);
    }
}

async function llamarTurno(id) {
    if (turnoActual) {
        alert(
            "Este puesto ya está atendiendo un turno."
        );

        return;
    }

    try {
        const respuesta =
            await fetch(
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

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.error ||
                "No fue posible llamar el turno"
            );
        }

        turnoActual = datos;

        numeroActual.textContent =
            datos.turno;

        pisoActual.textContent =
            `Piso ${datos.piso} - PC ${datos.puesto}`;

        botonFinalizar.disabled = false;

        await cargarTurnos();

    } catch (error) {
        alert(error.message);

        await cargarTurnos();
    }
}

async function finalizarTurno() {
    if (!turnoActual) {
        return;
    }

    try {
        const respuesta =
            await fetch(
                `/api/turnos/${turnoActual.id}/finalizar`,
                {
                    method: "POST"
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.error ||
                "No fue posible finalizar el turno"
            );
        }

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

validarPuesto();

configurarInterfaz();

pisoActual.textContent =
    `Piso ${pisoSeleccionado} - PC ${puestoSeleccionado}`;

cargarTurnos();

setInterval(
    cargarTurnos,
    2000
);

botonFinalizar.addEventListener(
    "click",
    finalizarTurno
);
