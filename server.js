const express = require("express");
const path = require("path");
const fs = require("fs");

const db = require("./database/database");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const carpetaReportes = path.join(__dirname, "reportes");

if (!fs.existsSync(carpetaReportes)) {
    fs.mkdirSync(carpetaReportes, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function obtenerFechaHoraArgentina() {
    const ahora = new Date();

    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(ahora);

    const valores = {};

    partes.forEach((parte) => {
        if (parte.type !== "literal") {
            valores[parte.type] = parte.value;
        }
    });

    return {
        fecha: `${valores.year}-${valores.month}-${valores.day}`,
        hora: `${valores.hour}:${valores.minute}:${valores.second}`
    };
}

function formatearTurno(tipo, numero) {
    return `${tipo}-${String(numero).padStart(3, "0")}`;
}

function responderError(res, status, mensaje) {
    return res.status(status).json({
        ok: false,
        error: mensaje
    });
}

const generarTurno = db.transaction((tipo) => {
    const { fecha, hora } = obtenerFechaHoraArgentina();

    const ultimoTurno = db.prepare(`
        SELECT numero
        FROM turnos
        WHERE tipo = ?
        AND fecha = ?
        ORDER BY numero DESC
        LIMIT 1
    `).get(tipo, fecha);

    const siguienteNumero = ultimoTurno
        ? ultimoTurno.numero + 1
        : 1;

    const resultado = db.prepare(`
        INSERT INTO turnos
        (
            numero,
            tipo,
            fecha,
            hora,
            estado
        )
        VALUES (?, ?, ?, ?, ?)
    `).run(
        siguienteNumero,
        tipo,
        fecha,
        hora,
        "ESPERANDO"
    );

    return {
        id: resultado.lastInsertRowid,
        turno: formatearTurno(tipo, siguienteNumero),
        tipo,
        fecha,
        hora,
        estado: "ESPERANDO"
    };
});

const llamarTurno = db.transaction((id, piso, puesto) => {
    const { fecha, hora } = obtenerFechaHoraArgentina();

    const turnoActivo = db.prepare(`
        SELECT
            id,
            numero,
            tipo,
            piso,
            puesto
        FROM turnos
        WHERE piso = ?
        AND puesto = ?
        AND estado = 'LLAMADO'
        AND fecha = ?
        LIMIT 1
    `).get(piso, puesto, fecha);

    if (turnoActivo) {
        throw new Error(
            `El puesto Piso ${piso} - PC ${puesto} ya está atendiendo el turno ${turnoActivo.tipo}-${String(turnoActivo.numero).padStart(3, "0")}`
        );
    }

    const resultado = db.prepare(`
        UPDATE turnos
        SET
            estado = 'LLAMADO',
            piso = ?,
            puesto = ?,
            fecha_llamado = ?,
            hora_llamado = ?
        WHERE id = ?
        AND estado = 'ESPERANDO'
        AND fecha = ?
    `).run(
        piso,
        puesto,
        fecha,
        hora,
        id,
        fecha
    );

    if (resultado.changes === 0) {
        const turno = db.prepare(`
            SELECT
                id,
                numero,
                tipo,
                fecha,
                hora,
                estado,
                piso,
                puesto,
                fecha_llamado,
                hora_llamado
            FROM turnos
            WHERE id = ?
        `).get(id);

        if (!turno) {
            throw new Error("Turno no encontrado");
        }

        if (turno.fecha !== fecha) {
            throw new Error("El turno pertenece a otro día");
        }

        throw new Error("El turno ya no está disponible");
    }

    const turno = db.prepare(`
        SELECT
            id,
            numero,
            tipo,
            fecha,
            hora,
            estado,
            piso,
            puesto,
            fecha_llamado,
            hora_llamado
        FROM turnos
        WHERE id = ?
    `).get(id);

    return {
        ...turno,
        turno: formatearTurno(
            turno.tipo,
            turno.numero
        )
    };
});

const finalizarTurno = db.transaction((id) => {
    const { fecha, hora } = obtenerFechaHoraArgentina();

    const turno = db.prepare(`
        SELECT
            id,
            numero,
            tipo,
            fecha,
            hora,
            estado,
            piso,
            puesto,
            fecha_llamado,
            hora_llamado
        FROM turnos
        WHERE id = ?
    `).get(id);

    if (!turno) {
        throw new Error("Turno no encontrado");
    }

    if (turno.fecha !== fecha) {
        throw new Error("El turno pertenece a otro día");
    }

    if (turno.estado !== "LLAMADO") {
        throw new Error("El turno no está siendo atendido");
    }

    db.prepare(`
        UPDATE turnos
        SET
            estado = 'FINALIZADO',
            fecha_finalizado = ?,
            hora_finalizado = ?
        WHERE id = ?
        AND estado = 'LLAMADO'
    `).run(
        fecha,
        hora,
        id
    );

    return {
        ...turno,
        turno: formatearTurno(
            turno.tipo,
            turno.numero
        ),
        estado: "FINALIZADO",
        fecha_finalizado: fecha,
        hora_finalizado: hora
    };
});

function serializarTurno(turno) {
    return {
        ...turno,
        turno: formatearTurno(
            turno.tipo,
            turno.numero
        )
    };
}

function escaparCSV(valor) {
    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }

    const texto = String(valor);

    if (
        texto.includes(",") ||
        texto.includes('"') ||
        texto.includes("\n")
    ) {
        return `"${texto.replace(/"/g, '""')}"`;
    }

    return texto;
}

function obtenerHistorial(fecha, estado = "TODOS") {
    let consulta = `
        SELECT
            id,
            numero,
            tipo,
            fecha,
            hora,
            estado,
            piso,
            puesto,
            fecha_llamado,
            hora_llamado,
            fecha_finalizado,
            hora_finalizado
        FROM turnos
        WHERE fecha = ?
    `;

    const parametros = [fecha];

    if (
        estado === "ESPERANDO" ||
        estado === "LLAMADO" ||
        estado === "FINALIZADO"
    ) {
        consulta += `
            AND estado = ?
        `;

        parametros.push(estado);
    }

    consulta += `
        ORDER BY id ASC
    `;

    return db
        .prepare(consulta)
        .all(...parametros);
}

function generarCSV(turnos) {
    const encabezado = [
        "Turno",
        "Tipo",
        "Fecha",
        "Hora generado",
        "Hora llamado",
        "Piso",
        "PC",
        "Fecha finalizado",
        "Hora finalizado",
        "Estado"
    ];

    const filas = turnos.map((turno) => [
        formatearTurno(
            turno.tipo,
            turno.numero
        ),
        turno.tipo,
        turno.fecha,
        turno.hora,
        turno.hora_llamado,
        turno.piso,
        turno.puesto,
        turno.fecha_finalizado,
        turno.hora_finalizado,
        turno.estado
    ]);

    return [
        encabezado,
        ...filas
    ]
        .map((fila) =>
            fila.map(escaparCSV).join(",")
        )
        .join("\n");
}

function exportarReporteDiario(fecha) {
    const turnos = db.prepare(`
        SELECT
            id,
            numero,
            tipo,
            fecha,
            hora,
            estado,
            piso,
            puesto,
            fecha_llamado,
            hora_llamado,
            fecha_finalizado,
            hora_finalizado
        FROM turnos
        WHERE fecha_llamado = ?
        ORDER BY hora_llamado ASC, id ASC
    `).all(fecha);

    const contenido = generarCSV(turnos);

    const rutaArchivo = path.join(
        carpetaReportes,
        `${fecha}.csv`
    );

    fs.writeFileSync(
        rutaArchivo,
        "\ufeff" + contenido,
        "utf8"
    );

    console.log(
        `Reporte diario generado: ${rutaArchivo}`
    );
}

let ultimaFechaReporte = null;

function programarReporteDiario() {
    const ahora = new Date();

    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(ahora);

    const valores = {};

    partes.forEach((parte) => {
        if (parte.type !== "literal") {
            valores[parte.type] = parte.value;
        }
    });

    const fechaActual =
        `${valores.year}-${valores.month}-${valores.day}`;

    const horaActual =
        Number(valores.hour);

    const minutoActual =
        Number(valores.minute);

    const segundoActual =
        Number(valores.second);

    const milisegundosActuales =
        (
            horaActual * 3600 +
            minutoActual * 60 +
            segundoActual
        ) * 1000;

    const milisegundos21 =
        21 * 3600 * 1000;

    let demora;

    if (
        milisegundosActuales <
        milisegundos21
    ) {
        demora =
            milisegundos21 -
            milisegundosActuales;
    } else {
        demora =
            24 * 60 * 60 * 1000 -
            milisegundosActuales +
            milisegundos21;
    }

    setTimeout(() => {
        const { fecha } =
            obtenerFechaHoraArgentina();

        if (
            ultimaFechaReporte !== fecha
        ) {
            try {
                exportarReporteDiario(fecha);
                ultimaFechaReporte = fecha;
            } catch (error) {
                console.error(
                    "No fue posible generar el reporte diario:",
                    error
                );
            }
        }

        programarReporteDiario();
    }, demora);
}

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        status: "ok"
    });
});

app.post("/api/turnos", (req, res) => {
    const { tipo } = req.body;

    if (
        tipo !== "R" &&
        tipo !== "C"
    ) {
        return responderError(
            res,
            400,
            "Tipo de turno inválido"
        );
    }

    try {
        const turno =
            generarTurno(tipo);

        res.json(turno);
    } catch (error) {
        console.error(error);

        responderError(
            res,
            500,
            "No fue posible generar el turno"
        );
    }
});

app.get("/api/turnos/esperando", (req, res) => {
    try {
        const { fecha } =
            obtenerFechaHoraArgentina();

        const turnos = db.prepare(`
            SELECT
                id,
                numero,
                tipo,
                fecha,
                hora,
                estado
            FROM turnos
            WHERE fecha = ?
            AND estado = 'ESPERANDO'
            ORDER BY id ASC
        `).all(fecha);

        res.json(
            turnos.map(serializarTurno)
        );
    } catch (error) {
        console.error(error);

        responderError(
            res,
            500,
            "No fue posible consultar los turnos"
        );
    }
});

app.get("/api/turnos/llamados", (req, res) => {
    try {
        const { fecha } =
            obtenerFechaHoraArgentina();

        const turnos = db.prepare(`
            SELECT
                id,
                numero,
                tipo,
                fecha,
                hora,
                estado,
                piso,
                puesto,
                fecha_llamado,
                hora_llamado
            FROM turnos
            WHERE fecha = ?
            AND estado = 'LLAMADO'
            AND piso IS NOT NULL
            AND puesto IS NOT NULL
            ORDER BY piso ASC, puesto ASC
        `).all(fecha);

        res.json(
            turnos.map(serializarTurno)
        );
    } catch (error) {
        console.error(error);

        responderError(
            res,
            500,
            "No fue posible consultar los turnos llamados"
        );
    }
});

app.post("/api/turnos/:id/llamar", (req, res) => {
    const id =
        Number(req.params.id);

    const piso =
        Number(req.body.piso);

    const puesto =
        Number(req.body.puesto);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        return responderError(
            res,
            400,
            "ID de turno inválido"
        );
    }

    if (
        piso !== 1 &&
        piso !== 2
    ) {
        return responderError(
            res,
            400,
            "Piso inválido"
        );
    }

    const puestosPermitidos =
        piso === 1
            ? [1, 2]
            : [1, 2, 3];

    if (
        !puestosPermitidos.includes(
            puesto
        )
    ) {
        return responderError(
            res,
            400,
            "Puesto inválido"
        );
    }

    try {
        const turno =
            llamarTurno(
                id,
                piso,
                puesto
            );

        res.json(turno);
    } catch (error) {
        console.error(error);

        const mensajes = {
            "Turno no encontrado": 404,
            "El turno ya no está disponible": 409,
            "El turno pertenece a otro día": 409
        };

        const status =
            mensajes[error.message] ||
            409;

        const mensaje =
            error.message ||
            "No fue posible llamar el turno";

        responderError(
            res,
            status,
            mensaje
        );
    }
});

app.post("/api/turnos/:id/finalizar", (req, res) => {
    const id =
        Number(req.params.id);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        return responderError(
            res,
            400,
            "ID de turno inválido"
        );
    }

    try {
        const turno =
            finalizarTurno(id);

        res.json(turno);
    } catch (error) {
        console.error(error);

        const mensajes = {
            "Turno no encontrado": 404,
            "El turno no está siendo atendido": 409,
            "El turno pertenece a otro día": 409
        };

        const status =
            mensajes[error.message] ||
            409;

        const mensaje =
            error.message ||
            "No fue posible finalizar el turno";

        responderError(
            res,
            status,
            mensaje
        );
    }
});

app.get("/api/historial", (req, res) => {
    const fecha =
        String(req.query.fecha || "");

    const estado =
        String(
            req.query.estado || "TODOS"
        );

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ) {
        return responderError(
            res,
            400,
            "Fecha inválida"
        );
    }

    try {
        const turnos =
            obtenerHistorial(
                fecha,
                estado
            );

        res.json(
            turnos.map(serializarTurno)
        );
    } catch (error) {
        console.error(error);

        responderError(
            res,
            500,
            "No fue posible obtener el historial"
        );
    }
});

app.get("/api/historial/exportar", (req, res) => {
    const fecha =
        String(req.query.fecha || "");

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ) {
        return responderError(
            res,
            400,
            "Fecha inválida"
        );
    }

    try {
        const turnos =
            obtenerHistorial(fecha);

        const contenido =
            generarCSV(turnos);

        res.setHeader(
            "Content-Type",
            "text/csv; charset=utf-8"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="historial-${fecha}.csv"`
        );

        res.send(
            "\ufeff" + contenido
        );
    } catch (error) {
        console.error(error);

        responderError(
            res,
            500,
            "No fue posible exportar el historial"
        );
    }
});

programarReporteDiario();

app.listen(PORT, () => {
    console.log(
        `Servidor iniciado en http://localhost:${PORT}`
    );
});
