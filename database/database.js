const Database = require("better-sqlite3");
const path = require("path");

const rutaBaseDatos = path.join(__dirname, "..", "turnero.db");

const db = new Database(rutaBaseDatos);

db.pragma("journal_mode = WAL");

db.exec(`
    CREATE TABLE IF NOT EXISTS turnos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero INTEGER NOT NULL,
        tipo TEXT NOT NULL CHECK(tipo IN ('R', 'C')),
        fecha TEXT NOT NULL,
        hora TEXT NOT NULL,
        estado TEXT NOT NULL CHECK(estado IN ('ESPERANDO', 'LLAMADO', 'FINALIZADO')),
        piso INTEGER,
        puesto INTEGER,
        fecha_llamado TEXT,
        hora_llamado TEXT,
        fecha_finalizado TEXT,
        hora_finalizado TEXT
    )
`);

const columnas = db.prepare(`
    PRAGMA table_info(turnos)
`).all();

const nombresColumnas = columnas.map(
    (columna) => columna.name
);

if (!nombresColumnas.includes("piso")) {
    db.exec(`
        ALTER TABLE turnos
        ADD COLUMN piso INTEGER
    `);
}

if (!nombresColumnas.includes("puesto")) {
    db.exec(`
        ALTER TABLE turnos
        ADD COLUMN puesto INTEGER
    `);
}

if (!nombresColumnas.includes("fecha_llamado")) {
    db.exec(`
        ALTER TABLE turnos
        ADD COLUMN fecha_llamado TEXT
    `);
}

if (!nombresColumnas.includes("hora_llamado")) {
    db.exec(`
        ALTER TABLE turnos
        ADD COLUMN hora_llamado TEXT
    `);
}

if (!nombresColumnas.includes("fecha_finalizado")) {
    db.exec(`
        ALTER TABLE turnos
        ADD COLUMN fecha_finalizado TEXT
    `);
}

if (!nombresColumnas.includes("hora_finalizado")) {
    db.exec(`
        ALTER TABLE turnos
        ADD COLUMN hora_finalizado TEXT
    `);
}

module.exports = db;
