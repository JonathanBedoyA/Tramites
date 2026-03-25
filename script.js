/* =====================================================
   SISTEMA ESCOLAR - LOGICA PRINCIPAL CON ROLES
   Roles activos:
   1) Alumno (ingresa con matricula)
   2) Control escolar (revisa y libera tramites/documentos)
   ===================================================== */

const CLAVE_DB = "tramitesDB";

const ALUMNOS_DEMO = [
    { matricula: "A001", nombre: "Juan Perez", grado: "3A", password: "1234" },
    { matricula: "A002", nombre: "Maria Lopez", grado: "2B", password: "1234" }
];

const CONTROL_DEMO = {
    usuario: "control",
    password: "admin123",
    nombre: "Control Escolar"
};

let sesionActual = null;

/* Arranque: dejamos la base lista desde el inicio para que todo funcione sin backend */
inicializarBase();

/* =====================================================
   LOGIN
   ===================================================== */
function login() {
    const rol = document.getElementById("rol").value;
    const usuario = document.getElementById("usuario").value.trim().toUpperCase();
    const pass = document.getElementById("password").value.trim();

    if (!usuario || !pass) {
        alert("Completa usuario/matricula y contrasena.");
        return;
    }

    if (rol === "alumno") {
        const alumno = ALUMNOS_DEMO.find((a) => a.matricula === usuario && a.password === pass);

        if (!alumno) {
            alert("Matricula o contrasena incorrecta.");
            return;
        }

        sesionActual = {
            rol: "alumno",
            matricula: alumno.matricula,
            nombre: alumno.nombre,
            grado: alumno.grado
        };
    } else {
        if (usuario.toLowerCase() !== CONTROL_DEMO.usuario || pass !== CONTROL_DEMO.password) {
            alert("Usuario de control o contrasena incorrecta.");
            return;
        }

        sesionActual = {
            rol: "control",
            nombre: CONTROL_DEMO.nombre
        };
    }

    document.getElementById("login").style.display = "none";
    document.getElementById("dashboard").style.display = "block";

    configurarMenuPorRol();
    mostrar("inicio");
}

function cerrarSesion() {
    sesionActual = null;
    location.reload();
}

/* =====================================================
   VISTAS POR SECCION
   ===================================================== */
function mostrar(seccion) {
    const contenido = document.getElementById("contenido");

    if (!sesionActual) {
        contenido.innerHTML = "<p>Primero inicia sesion.</p>";
        return;
    }

    if (seccion === "inicio") {
        if (sesionActual.rol === "alumno") {
            contenido.innerHTML = `
                <h2>🏠 Inicio</h2>
                <p>Hola <b>${sesionActual.nombre}</b> (${sesionActual.matricula}) de ${sesionActual.grado}.</p>
                <p>Desde aqui puedes revisar tus tramites, subir documentos pendientes y descargar documentos liberados para ti.</p>
            `;
        } else {
            const resumen = obtenerResumenControl();
            contenido.innerHTML = `
                <h2>🏠 Inicio de Control Escolar</h2>
                <p>Bienvenido(a), <b>${sesionActual.nombre}</b>.</p>
                <div class="grid-resumen">
                    <div class="resumen-box">Solicitudes en revision: <b>${resumen.enRevision}</b></div>
                    <div class="resumen-box">Pendientes por documento: <b>${resumen.faltaDocumento}</b></div>
                    <div class="resumen-box">Tramites aprobados: <b>${resumen.aprobados}</b></div>
                </div>
            `;
        }
    }

    if (seccion === "info") {
        if (sesionActual.rol !== "alumno") {
            contenido.innerHTML = `
                <h2>📊 Informacion</h2>
                <p>Esta seccion es solo para alumno.</p>
            `;
            return;
        }

        contenido.innerHTML = `
            <h2>📊 Informacion Academica</h2>
            <p>Alumno: ${sesionActual.nombre}</p>
            <p>Matricula: ${sesionActual.matricula}</p>
            <p>Grado: ${sesionActual.grado}</p>
            <p>Promedio: 9.2</p>
        `;
    }

    if (seccion === "gestion") {
        if (sesionActual.rol !== "control") {
            contenido.innerHTML = `
                <h2>🛠️ Gestion Escolar</h2>
                <p>Esta seccion es solo para control escolar.</p>
            `;
            return;
        }

        const db = leerDB();
        const filas = Object.values(db.alumnos).map((alumno) => {
            const pendientes = alumno.tramites.filter((t) => t.estado !== "Aprobado").length;
            return `
                <tr>
                    <td>${alumno.matricula}</td>
                    <td>${alumno.nombre}</td>
                    <td>${alumno.grado}</td>
                    <td>${pendientes}</td>
                </tr>
            `;
        }).join("");

        contenido.innerHTML = `
            <h2>🛠️ Gestion Escolar</h2>
            <p>Vista rapida de alumnos y carga de pendientes.</p>
            <table class="tabla-control">
                <thead>
                    <tr>
                        <th>Matricula</th>
                        <th>Alumno</th>
                        <th>Grado</th>
                        <th>Tramites pendientes</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas}
                </tbody>
            </table>
        `;
    }

    if (seccion === "tramites") {
        if (sesionActual.rol === "alumno") {
            renderTramitesAlumno(contenido);
        } else {
            renderTramitesControl(contenido);
        }
    }

    if (seccion === "documentos") {
        if (sesionActual.rol === "alumno") {
            renderDocumentosAlumno(contenido);
        } else {
            renderDocumentosControl(contenido);
        }
    }

    if (seccion === "notificaciones") {
        renderNotificaciones(contenido);
    }
}

/* =====================================================
   RENDER DE TRAMITES
   ===================================================== */
function renderTramitesAlumno(contenido) {
    const alumno = obtenerAlumnoActual();

    const tarjetas = alumno.tramites.map((tramite) => {
        const claseEstado = clasePorEstado(tramite.estado);
        const subirSeccion = tramite.estado === "Falta documento"
            ? `
                <div class="upload-box">
                    <label>Sube aqui el documento faltante:</label>
                    <input type="file" id="archivo-${tramite.id}" accept=".pdf,.jpg,.jpeg,.png">
                    <button onclick="subirDocumento('${tramite.id}')">Enviar documento</button>
                </div>
            `
            : "";

        return `
            <div class="tramite-card">
                <div class="tramite-top">
                    <h3>${tramite.tipo}</h3>
                    <span class="estado ${claseEstado}">${textoEstadoConIcono(tramite.estado)}</span>
                </div>
                <p>${tramite.observacion || "Sin observaciones."}</p>
                <p><b>Ultima actualizacion:</b> ${tramite.fechaActualizacion}</p>
                <p><b>Archivo subido:</b> ${tramite.archivoNombre || "Aun no subes archivo"}</p>
                ${subirSeccion}
            </div>
        `;
    }).join("");

    contenido.innerHTML = `
        <h2>📄 Mis Tramites</h2>
        <p>Aqui puedes ver estado, observaciones y subir documentos pendientes.</p>
        ${tarjetas}
    `;
}

function renderTramitesControl(contenido) {
    const db = leerDB();
    let bloques = "";

    Object.values(db.alumnos).forEach((alumno) => {
        const tarjetas = alumno.tramites.map((tramite) => {
            const claseEstado = clasePorEstado(tramite.estado);

            return `
                <div class="tramite-card">
                    <div class="tramite-top">
                        <h3>${tramite.tipo} - ${alumno.nombre} (${alumno.matricula})</h3>
                        <span class="estado ${claseEstado}">${textoEstadoConIcono(tramite.estado)}</span>
                    </div>
                    <p><b>Documento subido:</b> ${tramite.archivoNombre || "No"}</p>
                    <p><b>Observacion actual:</b> ${tramite.observacion || "Sin observaciones"}</p>
                    <div class="control-form-row">
                        <select id="estado-${alumno.matricula}-${tramite.id}">
                            <option value="En revision" ${tramite.estado === "En revision" ? "selected" : ""}>En revision</option>
                            <option value="Aprobado" ${tramite.estado === "Aprobado" ? "selected" : ""}>Aprobado</option>
                            <option value="Falta documento" ${tramite.estado === "Falta documento" ? "selected" : ""}>Falta documento</option>
                        </select>
                        <input id="obs-${alumno.matricula}-${tramite.id}" type="text" placeholder="Observacion breve" value="${tramite.observacion || ""}">
                        <button onclick="actualizarEstadoControl('${alumno.matricula}','${tramite.id}')">Guardar cambio</button>
                    </div>
                </div>
            `;
        }).join("");

        bloques += `<h3 class="separador-alumno">${alumno.nombre} (${alumno.matricula})</h3>${tarjetas}`;
    });

    contenido.innerHTML = `
        <h2>📄 Tramites - Control Escolar</h2>
        <p>Desde aqui validas documentos y actualizas estado de cada solicitud.</p>
        ${bloques}
    `;
}

/* =====================================================
   RENDER DE DOCUMENTOS
   ===================================================== */
function renderDocumentosAlumno(contenido) {
    const alumno = obtenerAlumnoActual();
    const docs = alumno.documentosLiberados;

    if (!docs.length) {
        contenido.innerHTML = `
            <h2>📁 Mis Documentos</h2>
            <p>Aun no hay documentos liberados para tu cuenta.</p>
        `;
        return;
    }

    const lista = docs.map((doc) => `
        <div class="tramite-card">
            <div class="tramite-top">
                <h3>${doc.titulo}</h3>
                <span class="estado estado-aprobado">🟢 Liberado</span>
            </div>
            <p><b>Fecha de liberacion:</b> ${doc.fechaLiberacion}</p>
            <button onclick="descargarDocumento('${doc.id}')">Descargar</button>
        </div>
    `).join("");

    contenido.innerHTML = `
        <h2>📁 Mis Documentos</h2>
        <p>Aqui puedes descargar los documentos que control escolar ya libero para ti.</p>
        ${lista}
    `;
}

function renderDocumentosControl(contenido) {
    const opcionesAlumno = ALUMNOS_DEMO.map((a) => `<option value="${a.matricula}">${a.matricula} - ${a.nombre}</option>`).join("");

    contenido.innerHTML = `
        <h2>📁 Documentos - Control Escolar</h2>
        <p>Libera documentos para que cada alumno pueda descargarlos desde su cuenta.</p>

        <div class="tramite-card">
            <h3>Liberar documento</h3>
            <div class="control-form-row">
                <select id="controlMatriculaDoc">${opcionesAlumno}</select>
                <select id="controlTipoDoc">
                    <option value="Constancia de estudios">Constancia de estudios</option>
                    <option value="Boleta de calificaciones">Boleta de calificaciones</option>
                    <option value="Comprobante de reinscripcion">Comprobante de reinscripcion</option>
                </select>
                <button onclick="liberarDocumentoControl()">Liberar documento</button>
            </div>
        </div>
    `;
}

/* =====================================================
   NOTIFICACIONES
   ===================================================== */
function renderNotificaciones(contenido) {
    if (sesionActual.rol === "alumno") {
        const alumno = obtenerAlumnoActual();
        const pendientes = alumno.tramites.filter((t) => t.estado === "Falta documento").length;

        contenido.innerHTML = `
            <h2>🔔 Notificaciones</h2>
            <ul>
                <li>📢 Tienes ${pendientes} tramite(s) con documento pendiente.</li>
                <li>📢 Documentos liberados para descarga: ${alumno.documentosLiberados.length}.</li>
                <li>📢 Revisa la seccion Tramites para subir archivos faltantes.</li>
            </ul>
        `;
    } else {
        const resumen = obtenerResumenControl();
        contenido.innerHTML = `
            <h2>🔔 Notificaciones - Control Escolar</h2>
            <ul>
                <li>📢 Tramites en revision: ${resumen.enRevision}.</li>
                <li>📢 Tramites con documento faltante: ${resumen.faltaDocumento}.</li>
                <li>📢 Tramites aprobados: ${resumen.aprobados}.</li>
            </ul>
        `;
    }
}

/* =====================================================
   ACCIONES DE ALUMNO Y CONTROL
   ===================================================== */
function subirDocumento(tramiteId) {
    const input = document.getElementById(`archivo-${tramiteId}`);

    if (!input || !input.files || !input.files[0]) {
        alert("Selecciona un archivo antes de enviarlo.");
        return;
    }

    const db = leerDB();
    const alumno = db.alumnos[sesionActual.matricula];
    const tramite = alumno.tramites.find((t) => t.id === tramiteId);

    tramite.archivoNombre = input.files[0].name;
    tramite.estado = "En revision";
    tramite.observacion = "Documento recibido. Control escolar revisara el archivo.";
    tramite.fechaActualizacion = fechaHoy();

    guardarDB(db);
    alert("Documento enviado correctamente.");
    mostrar("tramites");
}

function actualizarEstadoControl(matricula, tramiteId) {
    const estado = document.getElementById(`estado-${matricula}-${tramiteId}`).value;
    const obs = document.getElementById(`obs-${matricula}-${tramiteId}`).value.trim();

    const db = leerDB();
    const alumno = db.alumnos[matricula];
    const tramite = alumno.tramites.find((t) => t.id === tramiteId);

    tramite.estado = estado;
    tramite.observacion = obs || "Actualizado por control escolar.";
    tramite.fechaActualizacion = fechaHoy();

    guardarDB(db);
    alert("Estado actualizado.");
    mostrar("tramites");
}

function liberarDocumentoControl() {
    const matricula = document.getElementById("controlMatriculaDoc").value;
    const tipoDoc = document.getElementById("controlTipoDoc").value;

    const db = leerDB();
    const alumno = db.alumnos[matricula];

    const nuevoDoc = {
        id: `DOC-${Date.now()}`,
        titulo: tipoDoc,
        contenido: construirContenidoDocumento(alumno, tipoDoc),
        fechaLiberacion: fechaHoy(),
        liberadoPor: sesionActual.nombre
    };

    alumno.documentosLiberados.push(nuevoDoc);
    guardarDB(db);

    alert(`Documento liberado para ${alumno.nombre}.`);
}

function descargarDocumento(docId) {
    const alumno = obtenerAlumnoActual();
    const doc = alumno.documentosLiberados.find((d) => d.id === docId);

    if (!doc) {
        alert("No se encontro el documento.");
        return;
    }

    const blob = new Blob([doc.contenido], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.titulo.replace(/\s+/g, "_")}_${sesionActual.matricula}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/* =====================================================
   HELPERS Y BASE LOCAL
   ===================================================== */
function configurarMenuPorRol() {
    const panelUsuario = document.getElementById("panelUsuario");
    const menuInfo = document.getElementById("menuInfo");
    const menuGestion = document.getElementById("menuGestion");

    if (sesionActual.rol === "alumno") {
        panelUsuario.textContent = `Alumno: ${sesionActual.nombre} (${sesionActual.matricula})`;
        menuInfo.style.display = "block";
        menuGestion.style.display = "none";
    } else {
        panelUsuario.textContent = `Area: ${sesionActual.nombre}`;
        menuInfo.style.display = "none";
        menuGestion.style.display = "block";
    }
}

function inicializarBase() {
    const existente = localStorage.getItem(CLAVE_DB);

    if (existente) {
        return;
    }

    const alumnos = {};

    ALUMNOS_DEMO.forEach((alumno) => {
        alumnos[alumno.matricula] = {
            matricula: alumno.matricula,
            nombre: alumno.nombre,
            grado: alumno.grado,
            tramites: [
                {
                    id: "TR-INS",
                    tipo: "Inscripcion",
                    estado: "En revision",
                    observacion: "Tu solicitud fue recibida y esta en validacion.",
                    archivoNombre: "",
                    fechaActualizacion: fechaHoy()
                },
                {
                    id: "TR-REINS",
                    tipo: "Reinscripcion",
                    estado: "Aprobado",
                    observacion: "Tramite aprobado correctamente.",
                    archivoNombre: "comprobante_pago.pdf",
                    fechaActualizacion: fechaHoy()
                },
                {
                    id: "TR-CAMBIO",
                    tipo: "Cambio de grupo",
                    estado: "Falta documento",
                    observacion: "Falta constancia de no adeudo.",
                    archivoNombre: "",
                    fechaActualizacion: fechaHoy()
                }
            ],
            documentosLiberados: []
        };
    });

    const data = { alumnos };
    localStorage.setItem(CLAVE_DB, JSON.stringify(data));
}

function leerDB() {
    return JSON.parse(localStorage.getItem(CLAVE_DB));
}

function guardarDB(data) {
    localStorage.setItem(CLAVE_DB, JSON.stringify(data));
}

function obtenerAlumnoActual() {
    const db = leerDB();
    return db.alumnos[sesionActual.matricula];
}

function obtenerResumenControl() {
    const db = leerDB();
    const tramites = Object.values(db.alumnos).flatMap((a) => a.tramites);

    return {
        enRevision: tramites.filter((t) => t.estado === "En revision").length,
        faltaDocumento: tramites.filter((t) => t.estado === "Falta documento").length,
        aprobados: tramites.filter((t) => t.estado === "Aprobado").length
    };
}

function textoEstadoConIcono(estado) {
    if (estado === "Aprobado") return "🟢 Aprobado";
    if (estado === "En revision") return "🟡 En revision";
    return "🔴 Falta documento";
}

function clasePorEstado(estado) {
    if (estado === "Aprobado") return "estado-aprobado";
    if (estado === "En revision") return "estado-revision";
    return "estado-faltante";
}

function fechaHoy() {
    const hoy = new Date();
    return hoy.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function construirContenidoDocumento(alumno, tipoDoc) {
    return [
        "SISTEMA ESCOLAR SECUNDARIA",
        "",
        `Documento: ${tipoDoc}`,
        `Alumno: ${alumno.nombre}`,
        `Matricula: ${alumno.matricula}`,
        `Grado: ${alumno.grado}`,
        `Fecha de liberacion: ${fechaHoy()}`,
        "",
        "Este documento fue generado por control escolar."
    ].join("\n");
}
