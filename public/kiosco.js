const ESTADOS = {
    INICIO: "inicio",
    CARGANDO: "cargando",
    TURNO: "turno"
};

const botones = document.querySelectorAll(".botones button");
const contenedorInicio = document.querySelector(".botones");
const pantallaTurno = document.getElementById("pantallaTurno");
const numeroTurno = document.getElementById("numeroTurno");
const volverInicio = document.getElementById("volverInicio");

let estadoActual = ESTADOS.INICIO;

async function fetchJSON(url, opciones = {}) {
    const timeoutMs = opciones.timeoutMs || 8000;
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeoutMs);

    try {
        const respuesta = await fetch(url, {
            ...opciones,
            signal: controlador.signal
        });

        let datos = {};

        try {
            datos = await respuesta.json();
        } catch (error) {
            console.warn("La respuesta no tenía JSON válido:", error);
        }

        if (!respuesta.ok) {
            throw new Error(datos.error || "Error del servidor");
        }

        return datos;
    } finally {
        clearTimeout(temporizador);
    }
}

function actualizarEstado(nuevoEstado) {
    estadoActual = nuevoEstado;

    if (nuevoEstado === ESTADOS.TURNO) {
        contenedorInicio.style.display = "none";
        pantallaTurno.style.display = "block";
        return;
    }

    pantallaTurno.style.display = "none";
    contenedorInicio.style.display = "flex";
}

function prepararBoton(boton) {
    boton.disabled = false;
    boton.classList.remove("boton--loading");

    const contenidoOriginal = boton.dataset.originalContent || boton.innerHTML;
    boton.innerHTML = contenidoOriginal;
}

function mostrarCarga(boton) {
    boton.dataset.originalContent = boton.innerHTML;
    boton.innerHTML = `
        <span>Generando turno...</span>
        <span class="traduccion">Generating ticket...</span>
    `;
    boton.disabled = true;
    boton.classList.add("boton--loading");
}

async function generarTurno(tipo) {
    return fetchJSON("/api/turnos", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ tipo })
    });
}

function mostrarTurno(datos) {
    numeroTurno.textContent = datos.turno;
    actualizarEstado(ESTADOS.TURNO);
}

function volverAlInicio() {
    actualizarEstado(ESTADOS.INICIO);

    botones.forEach((boton) => {
        prepararBoton(boton);
    });

    const primerBoton = document.querySelector(".boton[data-tipo='R']");
    if (primerBoton) {
        primerBoton.focus();
    }
}

async function manejarClick(evento) {
    const boton = evento.currentTarget;

    if (boton.disabled || estadoActual === ESTADOS.CARGANDO) {
        return;
    }

    const tipo = boton.dataset.tipo;

    if (!tipo) {
        return;
    }

    estadoActual = ESTADOS.CARGANDO;
    mostrarCarga(boton);

    try {
        const datos = await generarTurno(tipo);
        console.log("Turno generado:", datos);
        mostrarTurno(datos);
    } catch (error) {
        console.error("Error:", error);
        alert(error.message || "No fue posible generar el turno.");
        prepararBoton(boton);
        estadoActual = ESTADOS.INICIO;
    }
}

botones.forEach((boton) => {
    boton.addEventListener("click", manejarClick);
});

volverInicio.addEventListener("click", volverAlInicio);
numeroTurno.setAttribute("aria-live", "polite");
