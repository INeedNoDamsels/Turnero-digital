# 🎫 Turnero Digital

Sistema de gestión de atención en sucursal orientado a ordenar la llegada de clientes, mejorar la visibilidad de los turnos y mantener un registro trazable de cada atención.

## 🎯 ¿Qué problema resuelve?

En una sucursal pueden llegar clientes con distintas necesidades, por lo que es necesario ordenar quién espera, quién está siendo atendido y qué ocurrió durante cada atención.

El sistema transforma la llegada del cliente en un flujo simple:

**Llegada → Turno → Llamado → Atención → Finalización → Registro**

## 🖥️ Funcionamiento

El cliente comienza el proceso desde un kiosco, donde selecciona una de las dos opciones disponibles:

- 📅 **Reserva previa**
- 💬 **Cotización nueva**

Según la opción seleccionada, se genera un turno identificado por tipo y numeración correlativa del día.

Ejemplos:

- `R-004` — Reserva
- `C-003` —     Cotización

El turno queda disponible para ser llamado desde el panel del asesor.

## 👨‍💼 Panel del asesor

Cada puesto puede visualizar los turnos pendientes y controlar la atención activa.

Al finalizar una atención, el puesto queda disponible para llamar al siguiente turno.

## 📺 Pantalla de llamados

Una pantalla permite a los clientes visualizar qué turno está siendo atendido y los llamados recientes.

También muestra:

- 🔊 Notificación sonora
- 🪑 Puesto de atención
- 🎫 Turno actualmente llamado
- 🕐 Llamados recientes

## 📊 Trazabilidad

Cada turno conserva información sobre su recorrido dentro del sistema:

- Turno y tipo
- Hora de generación
- Hora de llamado
- Puesto de atención
- Hora de finalización
- Estado

El historial permite filtrar la información por fecha y estado, además de exportar los datos para su posterior análisis.
