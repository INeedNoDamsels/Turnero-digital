const fecha = document.getElementById("fecha");
const estado = document.getElementById("estado");
const botonBuscar = document.getElementById("buscar");
const botonExportar = document.getElementById("exportar");
const tabla = document.getElementById("tabla");
const sinResultados = document.getElementById("sinResultados");
const resumen = document.getElementById("resumen");

function obtenerFechaActual() {
    const ahora = new Date();

    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(ahora);

    const valores = {};

    partes.forEach((parte) => {
        if (parte.type !== "literal") {
            valores[parte.type] = parte.value;
        }
    });

    return `${valores.year}-${valores.month}-${valores.day}`;
}

function escaparHTML(valor) {
    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }

    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function mostrarTurnos(turnos) {
    tabla.innerHTML = "";

    resumen.textContent =
        `${turnos.length} turno${turnos.length === 1 ? "" : "s"}`;

    if (turnos.length === 0) {
        sinResultados.style.display = "block";
        return;
    }

    sinResultados.style.display = "none";

    turnos.forEach((turno) => {
        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td>${escaparHTML(turno.turno)}</td>
            <td>${escaparHTML(turno.tipo)}</td>
            <td>${escaparHTML(turno.hora)}</td>
            <td>${escaparHTML(turno.hora_llamado || "-")}</td>
            <td>${escaparHTML(turno.piso || "-")}</td>
            <td>${escaparHTML(turno.puesto || "-")}</td>
            <td>${escaparHTML(turno.hora_finalizado || "-")}</td>
            <td>${escaparHTML(turno.estado)}</td>
        `;

        tabla.appendChild(fila);
    });
}

async function buscarHistorial() {
    const fechaSeleccionada = fecha.value;
    const estadoSeleccionado = estado.value;

    if (!fechaSeleccionada) {
        return;
    }

    try {
        botonBuscar.disabled = true;

        const respuesta = await fetch(
            `/api/historial?fecha=${encodeURIComponent(fechaSeleccionada)}&estado=${encodeURIComponent(estadoSeleccionado)}`,
            {
                cache: "no-store"
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.error ||
                "No fue posible obtener el historial"
            );
        }

        mostrarTurnos(datos);
    } catch (error) {
        console.error(error);
        alert(error.message);
    } finally {
        botonBuscar.disabled = false;
    }
}

function exportarCSV() {
    if (!fecha.value) {
        return;
    }

    window.location.href =
        `/api/historial/exportar?fecha=${encodeURIComponent(fecha.value)}`;
}

fecha.value = obtenerFechaActual();

botonBuscar.addEventListener(
    "click",
    buscarHistorial
);

botonExportar.addEventListener(
    "click",
    exportarCSV
);

estado.addEventListener(
    "change",
    buscarHistorial
);

buscarHistorial();
