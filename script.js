/* =====================================================
   SISTEMA ESCOLAR - CONTROL DE ACCESO POR ROLES (RBAC)
   Roles activos:
   1) Alumno
   2) Administrador
   3) Director
   4) Prefectura
   5) Docente
   ===================================================== */

const CLAVE_DB = "tramitesDBv2";
const CLAVE_BACKUPS = "tramitesBackups";
const UMBRAL_ALERTA_REPORTES = 3;

const USUARIOS_DEMO = [
    { rol: "administrador", usuario: "admin", password: "admin123", nombre: "Administrador General" },
    { rol: "director", usuario: "director1", password: "dir123", nombre: "Direccion Secundaria" },
    { rol: "prefectura", usuario: "pref1", password: "pref123", nombre: "Prefectura Turno Matutino" },
    { rol: "docente", usuario: "docente1", password: "doc123", nombre: "Docente Matematicas" }
];

const ALUMNOS_DEMO = [
    { matricula: "A001", nombre: "Juan Perez", grado: "3A", password: "1234" },
    { matricula: "A002", nombre: "Maria Lopez", grado: "2B", password: "1234" }
];

const PERMISOS = {
    administrador: {
        verExpediente: true,
        verCalificaciones: true,
        verDisciplina: true,
        verCartas: true,
        verEstadisticas: true,
        administrarCuentas: true,
        administrarCiclos: true,
        transicionCurso: true,
        altaAlumno: true,
        capturarCalificaciones: true,
        crearReporteConducta: true,
        programarCitatorio: true,
        crearCartaCompromiso: true,
        autorizarCarta: true
    },
    director: {
        verExpediente: true,
        verCalificaciones: true,
        verDisciplina: true,
        verCartas: true,
        verEstadisticas: true,
        administrarCuentas: false,
        administrarCiclos: false,
        transicionCurso: false,
        altaAlumno: false,
        capturarCalificaciones: false,
        crearReporteConducta: false,
        programarCitatorio: false,
        crearCartaCompromiso: false,
        autorizarCarta: true
    },
    prefectura: {
        verExpediente: true,
        verCalificaciones: true,
        verDisciplina: true,
        verCartas: true,
        verEstadisticas: false,
        administrarCuentas: false,
        administrarCiclos: false,
        transicionCurso: false,
        altaAlumno: false,
        capturarCalificaciones: false,
        crearReporteConducta: true,
        programarCitatorio: true,
        crearCartaCompromiso: true,
        autorizarCarta: false
    },
    docente: {
        verExpediente: false,
        verCalificaciones: true,
        verDisciplina: true,
        verCartas: false,
        verEstadisticas: false,
        administrarCuentas: false,
        administrarCiclos: false,
        transicionCurso: false,
        altaAlumno: false,
        capturarCalificaciones: true,
        crearReporteConducta: true,
        programarCitatorio: false,
        crearCartaCompromiso: false,
        autorizarCarta: false
    },
    alumno: {
        verExpediente: true,
        verCalificaciones: true,
        verDisciplina: true,
        verCartas: true,
        verEstadisticas: false,
        administrarCuentas: false,
        administrarCiclos: false,
        transicionCurso: false,
        altaAlumno: false,
        capturarCalificaciones: false,
        crearReporteConducta: false,
        programarCitatorio: false,
        crearCartaCompromiso: false,
        autorizarCarta: false
    }
};

let sesionActual = null;
let alumnoSeleccionadoGlobal = null;

inicializarBase();
migrarEstructuraDB();
ejecutarRespaldoDiario();
migrarCredencialesSeguras();

async function login() {
    const rol = document.getElementById("rol").value;
    const usuarioRaw = document.getElementById("usuario").value.trim();
    const pass = document.getElementById("password").value.trim();

    if (!usuarioRaw || !pass) {
        alert("Completa usuario/matricula y contrasena.");
        return;
    }

    if (rol === "alumno") {
        const matricula = usuarioRaw.toUpperCase();
        const db = leerDB();
        const alumno = db.alumnos[matricula];
        const acceso = alumno && await verificarPassword(pass, alumno.password);

        if (!acceso) {
            alert("Matricula o contrasena incorrecta.");
            return;
        }

        sesionActual = {
            rol: "alumno",
            usuario: matricula,
            matricula: alumno.matricula,
            nombre: alumno.nombre,
            grado: alumno.grado
        };
    } else {
        const usuario = usuarioRaw.toLowerCase();
        const db = leerDB();
        let cuenta = null;

        for (const item of db.usuarios) {
            if (item.rol !== rol || item.usuario !== usuario) {
                continue;
            }
            if (await verificarPassword(pass, item.password)) {
                cuenta = item;
                break;
            }
        }

        if (!cuenta) {
            alert("Credenciales incorrectas para el rol seleccionado.");
            return;
        }

        sesionActual = {
            rol: cuenta.rol,
            usuario: cuenta.usuario,
            nombre: cuenta.nombre
        };
    }

    document.getElementById("login").style.display = "none";
    document.getElementById("dashboard").style.display = "flex";

    configurarMenuPorRol();
    configurarBuscadorGlobal();
    mostrar("inicio");
}

function cerrarSesion() {
    sesionActual = null;
    location.reload();
}

function mostrar(seccion) {
    const contenido = document.getElementById("contenido");

    if (!sesionActual) {
        contenido.innerHTML = "<p>Primero inicia sesion.</p>";
        return;
    }

    if (seccion === "inicio") {
        renderInicio(contenido);
        return;
    }

    if (seccion === "info") {
        if (!tienePermiso("verExpediente")) return renderSinPermiso(contenido, "Expediente");
        renderExpediente(contenido);
        return;
    }

    if (seccion === "calificaciones") {
        if (!tienePermiso("verCalificaciones")) return renderSinPermiso(contenido, "Calificaciones");
        renderCalificaciones(contenido);
        return;
    }

    if (seccion === "disciplina") {
        if (!tienePermiso("verDisciplina")) return renderSinPermiso(contenido, "Disciplina");
        renderDisciplina(contenido);
        return;
    }

    if (seccion === "cartas") {
        if (!tienePermiso("verCartas")) return renderSinPermiso(contenido, "Cartas compromiso");
        renderCartas(contenido);
        return;
    }

    if (seccion === "estadisticas") {
        if (!tienePermiso("verEstadisticas")) return renderSinPermiso(contenido, "Estadisticas globales");
        renderEstadisticas(contenido);
        return;
    }

    if (seccion === "gestion") {
        const permiteGestion = tienePermiso("administrarCuentas") || tienePermiso("administrarCiclos") || tienePermiso("transicionCurso") || tienePermiso("altaAlumno");
        if (!permiteGestion) return renderSinPermiso(contenido, "Administracion");
        renderAdministracion(contenido);
        return;
    }

    if (seccion === "notificaciones") {
        renderNotificaciones(contenido);
    }
}

function renderInicio(contenido) {
    const resumen = obtenerResumenGlobal();

    if (sesionActual.rol === "alumno") {
        const alumno = obtenerAlumnoActual();
        contenido.innerHTML = `
            <h2>🏠 Inicio</h2>
            <p>Bienvenido, <b>${alumno.nombre}</b> (${alumno.matricula}) de ${alumno.grado}.</p>
            <div class="grid-resumen">
                <div class="resumen-box">Calificaciones registradas: <b>${alumno.calificaciones.length}</b></div>
                <div class="resumen-box">Reportes de conducta: <b>${alumno.reportesConducta.length}</b></div>
                <div class="resumen-box">Cartas compromiso: <b>${alumno.cartasCompromiso.length}</b></div>
            </div>
            <p>Tu historial se conserva por ciclos escolares (1°, 2° y 3°).</p>
        `;
        return;
    }

    const alertasRojas = sesionActual.rol === "director" ? obtenerAlertasRojas(UMBRAL_ALERTA_REPORTES) : [];
    const bloqueAlertasDireccion = sesionActual.rol === "director"
        ? `
            <div class="tramite-card alerta-roja-panel">
                <h3>🚨 Alertas para Direccion</h3>
                <p>Umbral configurado: ${UMBRAL_ALERTA_REPORTES} reportes acumulados.</p>
                <ul>
                    ${alertasRojas.length
            ? alertasRojas.map((a) => `<li>${a.matricula} - ${a.nombre}: <b>${a.reportes}</b> reportes (${a.grado})</li>`).join("")
            : "<li>Sin alertas rojas activas.</li>"}
                </ul>
            </div>
        `
        : "";

    contenido.innerHTML = `
        <h2>🏠 Panel ${textoRol(sesionActual.rol)}</h2>
        <p>Usuario activo: <b>${sesionActual.nombre}</b></p>
        <div class="grid-resumen">
            <div class="resumen-box">Alumnos registrados: <b>${resumen.totalAlumnos}</b></div>
            <div class="resumen-box">Reportes de conducta: <b>${resumen.totalReportes}</b></div>
            <div class="resumen-box">Citatorios programados: <b>${resumen.totalCitatorios}</b></div>
            <div class="resumen-box">Cartas por autorizar: <b>${resumen.cartasPendientes}</b></div>
        </div>
        ${bloqueAlertasDireccion}
        <p>Ciclo activo: <b>${leerDB().cicloActivo}</b></p>
    `;
}

function renderExpediente(contenido) {
    const alumno = obtenerAlumnoObjetivo("selectorExpediente");
    const cicloSeleccionadoPrevio = document.getElementById("selectorCicloExpediente")?.value;

    if (!alumno) {
        contenido.innerHTML = `
            <h2>📘 Expediente</h2>
            <p>No se encontro el alumno.</p>
        `;
        return;
    }

    const selectorAlumno = sesionActual.rol === "alumno"
        ? ""
        : `
            <div class="tramite-card">
                <div class="control-form-row">
                    <label for="selectorExpediente">Alumno:</label>
                    <select id="selectorExpediente" onchange="mostrar('info')">${opcionesAlumno(alumno.matricula)}</select>
                </div>
            </div>
        `;
    const ciclosAlumno = Object.keys(alumno.historialEscolar || {});
    const cicloSeleccionado = (cicloSeleccionadoPrevio && alumno.historialEscolar?.[cicloSeleccionadoPrevio])
        ? cicloSeleccionadoPrevio
        : (alumno.cicloActual || ciclosAlumno[0]);
    const historialCiclo = alumno.historialEscolar?.[cicloSeleccionado] || null;
    const historialDisciplinario = alumno.historialDisciplinario.map((item) => `
        <li>${item.fecha} - ${item.evento}</li>
    `).join("");

    const foto = alumno.datosGenerales.fotografia || "https://placehold.co/120x120?text=Alumno";
    const tipoSangre = alumno.datosGenerales.tipoSangre || "No definido";
    const alergias = alumno.datosGenerales.alergias || "Sin alergias registradas";
    const condiciones = alumno.datosGenerales.condicionesMedicas || "Sin condiciones registradas";

    const opcionesCiclo = ciclosAlumno.map((ciclo) => (
        `<option value="${ciclo}" ${ciclo === cicloSeleccionado ? "selected" : ""}>${ciclo}</option>`
    )).join("");

    contenido.innerHTML = `
        <h2>📘 Expediente Integral</h2>
        ${selectorAlumno}

        <div class="tramite-card">
            <h3>Datos Generales</h3>
            <div class="expediente-grid">
                <div class="foto-alumno-box">
                    <img src="${foto}" alt="Foto de ${alumno.nombre}" class="foto-alumno">
                </div>
                <div>
                    <p><b>Nombre completo:</b> ${alumno.datosGenerales.nombreCompleto}</p>
                    <p><b>CURP:</b> ${alumno.datosGenerales.curp || "No registrada"}</p>
                    <p><b>Fecha de nacimiento:</b> ${alumno.datosGenerales.fechaNacimiento || "No registrada"}</p>
                    <p><b>Tipo de sangre:</b> ${tipoSangre}</p>
                    <p><b>Alergias:</b> ${alergias}</p>
                    <p><b>Condiciones medicas:</b> ${condiciones}</p>
                </div>
            </div>
        </div>

        <div class="tramite-card">
            <h3>Datos de Contacto</h3>
            <p><b>Padre/Madre o tutor:</b> ${alumno.contacto.tutorNombre || "No registrado"}</p>
            <p><b>Telefono celular:</b> ${alumno.contacto.telefonoCelular || "No registrado"}</p>
            <p><b>Telefono emergencia:</b> ${alumno.contacto.telefonoEmergencia || "No registrado"}</p>
            <p><b>Correo electronico:</b> ${alumno.contacto.correo || "No registrado"}</p>
        </div>

        <div class="tramite-card">
            <h3>Historial Escolar</h3>
            <div class="control-form-row">
                <label for="selectorCicloExpediente">Ciclo escolar:</label>
                <select id="selectorCicloExpediente" onchange="mostrar('info')">${opcionesCiclo}</select>
            </div>
            <p><b>Ciclo actual:</b> ${alumno.cicloActual}</p>
            <p><b>Grado actual:</b> ${obtenerNumeroGrado(alumno.grado)}°</p>
            <p><b>Grupo actual:</b> ${obtenerGrupo(alumno.grado)}</p>
            <hr>
            <p><b>Consulta por ciclo (${cicloSeleccionado}):</b></p>
            <p><b>Grado:</b> ${historialCiclo ? historialCiclo.grado : "Sin registro"}</p>
            <p><b>Grupo:</b> ${historialCiclo ? historialCiclo.grupo : "Sin registro"}</p>
            <p><b>Estado:</b> ${historialCiclo ? historialCiclo.estado : "Sin registro"}</p>
            <p><b>Promedio anual:</b> ${historialCiclo ? historialCiclo.promedio : "Sin registro"}</p>
            <p><b>Observaciones:</b> ${historialCiclo ? (historialCiclo.observaciones || "Sin observaciones") : "Sin registro"}</p>
        </div>

        <div class="tramite-card">
            <h3>Historial Disciplinario</h3>
            <p><b>Historial disciplinario:</b></p>
            <ul>${historialDisciplinario || "<li>Sin incidencias registradas.</li>"}</ul>
        </div>
    `;
}

function renderCalificaciones(contenido) {
    const alumno = obtenerAlumnoObjetivo("selectorCalificaciones");

    if (!alumno) {
        contenido.innerHTML = "<h2>📝 Calificaciones</h2><p>No se encontro alumno.</p>";
        return;
    }

        const db = leerDB();
        const selector = sesionActual.rol === "alumno" ? "" : bloqueSelectorAlumno("selectorCalificaciones", "mostrar('calificaciones')");
        const cicloSeleccionado = document.getElementById("selectorCicloCalificaciones")?.value
            || alumno.cicloActual
            || db.cicloActivo;
        const listaFiltrada = alumno.calificaciones.filter((c) => c.ciclo === cicloSeleccionado);
        const lista = listaFiltrada.map((c) => `
        <tr>
                <td>${c.ciclo}</td>
            <td>${c.periodo}</td>
            <td>${c.materia}</td>
            <td>${c.valor}</td>
            <td>${c.fecha}</td>
            <td>${c.capturadoPor}</td>
        </tr>
    `).join("");
        const ciclosDisponibles = obtenerCiclosAlumno(alumno);
        const promediosPorCiclo = ciclosDisponibles.map((ciclo) => {
            const datos = calcularPromedioCiclo(alumno, ciclo);
            return `
                <tr>
                    <td>${ciclo}</td>
                    <td>${datos.materias}</td>
                    <td>${datos.promedio}</td>
                    <td>${datos.reportesConducta}</td>
                </tr>
            `;
        }).join("");

    const captura = tienePermiso("capturarCalificaciones") ? `
        <div class="tramite-card">
                <h3>Registro de calificaciones por asignatura y periodo</h3>
            <div class="control-form-row">
                ${sesionActual.rol === "alumno" ? "" : `<select id="capturaMatricula">${opcionesAlumno()}</select>`}
                    <select id="capturaCiclo">
                        ${db.ciclos.map((c) => `<option value="${c}" ${c === db.cicloActivo ? "selected" : ""}>${c}</option>`).join("")}
                    </select>
                <input id="capturaMateria" type="text" placeholder="Materia (ej. Matematicas)">
                <select id="capturaPeriodo">
                        <option value="Trimestre I">Trimestre I</option>
                        <option value="Trimestre II">Trimestre II</option>
                        <option value="Trimestre III">Trimestre III</option>
                </select>
                <input id="capturaValor" type="number" min="0" max="10" step="0.1" placeholder="Calificacion">
                <button onclick="capturarCalificacion()">Guardar calificacion</button>
            </div>
        </div>
    ` : "";

    contenido.innerHTML = `
        <h2>📝 Calificaciones</h2>
        ${selector}
            <div class="tramite-card">
                <h3>Consulta por ciclo escolar</h3>
                <div class="control-form-row">
                    <label for="selectorCicloCalificaciones">Ciclo:</label>
                    <select id="selectorCicloCalificaciones" onchange="mostrar('calificaciones')">
                        ${ciclosDisponibles.map((ciclo) => `<option value="${ciclo}" ${ciclo === cicloSeleccionado ? "selected" : ""}>${ciclo}</option>`).join("")}
                    </select>
                </div>
                <p>Promedio general automatico del ciclo <b>${cicloSeleccionado}</b>: <b>${calcularPromedioCiclo(alumno, cicloSeleccionado).promedio}</b></p>
            </div>
        ${captura}
        <table class="tabla-control">
            <thead>
                <tr>
                    <th>Ciclo</th>
                    <th>Periodo</th>
                    <th>Materia</th>
                    <th>Calificacion</th>
                    <th>Fecha</th>
                    <th>Capturado por</th>
                </tr>
            </thead>
            <tbody>
                ${lista || "<tr><td colspan='6'>Sin calificaciones en este ciclo.</td></tr>"}
            </tbody>
        </table>

        <div class="tramite-card">
            <h3>Record academico de ciclos anteriores</h3>
            <table class="tabla-control">
                <thead>
                    <tr>
                        <th>Ciclo</th>
                        <th>Registros academicos</th>
                        <th>Promedio general</th>
                        <th>Reportes de conducta</th>
                    </tr>
                </thead>
                <tbody>
                    ${promediosPorCiclo || "<tr><td colspan='4'>Sin historial.</td></tr>"}
                </tbody>
            </table>
        </div>

        <div class="tramite-card">
            <h3>Analisis de rendimiento vs disciplina</h3>
            ${construirAnalisisRendimientoDisciplinario(alumno)}
        </div>
    `;
}

function renderDisciplina(contenido) {
    const alumno = obtenerAlumnoObjetivo("selectorDisciplina", "busquedaAlumno");

    if (!alumno) {
        contenido.innerHTML = "<h2>⚖️ Disciplina</h2><p>No se encontro alumno con ese criterio.</p>";
        return;
    }

    const selector = sesionActual.rol === "alumno"
        ? ""
        : `
            <div class="tramite-card">
                <div class="control-form-row">
                    <input id="busquedaAlumno" type="text" placeholder="Buscar por matricula o nombre" oninput="mostrar('disciplina')">
                    <select id="selectorDisciplina" onchange="mostrar('disciplina')">${opcionesAlumno(alumno.matricula)}</select>
                </div>
            </div>
        `;

    const reportes = alumno.reportesConducta.map((r) => `
        <li>
            <b>${r.fecha} ${r.hora || ""}</b> | Motivo: ${r.motivo || "Sin motivo"} | Docente: ${r.docenteReporta || "No indicado"}<br>
            Hechos: ${r.descripcionHechos || r.descripcion || "Sin descripcion"}<br>
            Sancion aplicada: ${r.sancionAplicada || "Sin sancion"}
        </li>
    `).join("");
    const puedeGestionarCitatorio = tienePermiso("programarCitatorio");
    const citatorios = alumno.citatorios.map((c) => `
        <li>
            <b>${c.fecha} ${c.hora || ""}</b> | Area: ${c.area || "No definida"} | Motivo: ${c.motivo}
            <br>Estado: <b>${c.estado}</b>
            ${puedeGestionarCitatorio ? `
                <div class="control-form-row" style="margin-top:8px;">
                    <select id="estadoCit-${c.id}">
                        <option value="Programado" ${c.estado === "Programado" ? "selected" : ""}>Programado</option>
                        <option value="Asistio" ${c.estado === "Asistio" ? "selected" : ""}>Asistio</option>
                        <option value="No Asistio" ${c.estado === "No Asistio" ? "selected" : ""}>No Asistio</option>
                    </select>
                    <button onclick="actualizarEstadoCitatorio('${alumno.matricula}','${c.id}')">Actualizar estado</button>
                </div>
            ` : ""}
        </li>
    `).join("");

    const acciones = (tienePermiso("crearReporteConducta") || tienePermiso("programarCitatorio") || tienePermiso("crearCartaCompromiso")) ? `
        <div class="tramite-card">
            <h3>Acciones de disciplina</h3>
            <div class="control-form-row">
                ${sesionActual.rol === "alumno" ? "" : `<select id="disciplinaMatricula">${opcionesAlumno(alumno.matricula)}</select>`}
                <input id="disciplinaReporteFecha" type="date">
                <input id="disciplinaReporteHora" type="time">
                <input id="disciplinaReporteMotivo" type="text" placeholder="Motivo del reporte">
                <input id="disciplinaReporteDocente" type="text" placeholder="Docente que reporta">
                <input id="disciplinaReporteHechos" type="text" placeholder="Descripcion de los hechos">
                <input id="disciplinaReporteSancion" type="text" placeholder="Sancion aplicada">
                <button onclick="registrarReporteConducta()">Registrar reporte</button>
            </div>
            <div class="control-form-row" style="margin-top:10px;">
                ${sesionActual.rol === "alumno" ? "" : `<select id="disciplinaMatriculaCita">${opcionesAlumno(alumno.matricula)}</select>`}
                <input id="disciplinaCitatorioFecha" type="date">
                <input id="disciplinaCitatorioHora" type="time">
                <input id="disciplinaCitatorioMotivo" type="text" placeholder="Motivo del citatorio">
                <select id="disciplinaCitatorioArea">
                    <option value="Direccion">Direccion</option>
                    <option value="Prefectura">Prefectura</option>
                    <option value="Trabajo Social">Trabajo Social</option>
                </select>
                <button onclick="programarCitatorio()">Programar citatorio</button>
            </div>
            <div class="control-form-row" style="margin-top:10px;">
                ${sesionActual.rol === "alumno" ? "" : `<select id="disciplinaMatriculaCarta">${opcionesAlumno(alumno.matricula)}</select>`}
                <select id="disciplinaCartaOrigen">
                    <option value="Incidencia grave">Incidencia grave</option>
                    <option value="Acumulacion de reportes">Acumulacion de reportes</option>
                </select>
                <input id="disciplinaCartaMotivo" type="text" placeholder="Motivo de carta compromiso">
                <select id="disciplinaCartaTipoRegistro" onchange="alternarTipoCarta()">
                    <option value="archivo">Subir documento escaneado</option>
                    <option value="digital">Registro digital de acuerdos</option>
                </select>
                <input id="disciplinaCartaArchivo" type="file" accept=".pdf,.jpg,.jpeg,.png">
                <input id="disciplinaCartaAcuerdos" type="text" placeholder="Acuerdos establecidos (si es digital)" style="display:none;">
                <input id="disciplinaCartaVigencia" type="date" style="display:none;">
                <button onclick="crearCartaCompromiso()">Crear carta compromiso</button>
            </div>
        </div>
    ` : "";

    contenido.innerHTML = `
        <h2>⚖️ Disciplina</h2>
        ${selector}
        ${acciones}
        <div class="tramite-card">
            <h3>Historial de reportes</h3>
            <ul>${reportes || "<li>Sin reportes registrados.</li>"}</ul>
        </div>
        <div class="tramite-card">
            <h3>Citatorios con padres de familia</h3>
            <ul>${citatorios || "<li>Sin citatorios programados.</li>"}</ul>
        </div>
    `;
}

function renderCartas(contenido) {
    const alumno = obtenerAlumnoObjetivo("selectorCartas");

    if (!alumno) {
        contenido.innerHTML = "<h2>📄 Cartas compromiso</h2><p>No se encontro alumno.</p>";
        return;
    }

    const selector = sesionActual.rol === "alumno" ? "" : bloqueSelectorAlumno("selectorCartas", "mostrar('cartas')");
    const cartas = alumno.cartasCompromiso.map((c) => `
        <div class="tramite-card">
            <div class="tramite-top">
                <h3>${c.motivo}</h3>
                <span class="estado ${c.autorizada ? "estado-aprobado" : "estado-revision"}">${c.autorizada ? "Autorizada" : "Pendiente"}</span>
            </div>
            <p><b>Origen:</b> ${c.origen || "No indicado"}</p>
            <p><b>Fecha:</b> ${c.fecha}</p>
            <p><b>Creada por:</b> ${c.creadaPor}</p>
            <p><b>Tipo de registro:</b> ${c.tipoRegistro === "archivo" ? "Documento escaneado" : "Registro digital"}</p>
            <p><b>Documento escaneado:</b> ${c.documentoEscaneado || "No cargado"}</p>
            <p><b>Acuerdos:</b> ${c.acuerdos || "No aplica"}</p>
            <p><b>Vigencia:</b> ${c.vigencia || "No aplica"}</p>
            <p><b>Firma digital:</b> ${c.firmaDirector || "Pendiente"}</p>
            ${tienePermiso("autorizarCarta") && !c.autorizada ? `<button onclick="autorizarCarta('${alumno.matricula}', '${c.id}')">Autorizar digitalmente</button>` : ""}
        </div>
    `).join("");

    contenido.innerHTML = `
        <h2>📄 Cartas compromiso</h2>
        ${selector}
        ${cartas || "<p>No hay cartas registradas.</p>"}
    `;
}

function renderEstadisticas(contenido) {
    const resumen = obtenerResumenGlobal();

    contenido.innerHTML = `
        <h2>📊 Estadisticas globales</h2>
        <p>Vista de lectura para supervision directiva.</p>
        <div class="grid-resumen">
            <div class="resumen-box">Total alumnos: <b>${resumen.totalAlumnos}</b></div>
            <div class="resumen-box">Total calificaciones: <b>${resumen.totalCalificaciones}</b></div>
            <div class="resumen-box">Total reportes: <b>${resumen.totalReportes}</b></div>
            <div class="resumen-box">Total citatorios: <b>${resumen.totalCitatorios}</b></div>
            <div class="resumen-box">Cartas pendientes: <b>${resumen.cartasPendientes}</b></div>
            <div class="resumen-box">Cartas autorizadas: <b>${resumen.cartasAutorizadas}</b></div>
        </div>
    `;
}

function renderAdministracion(contenido) {
    const db = leerDB();
    const opcionesBaja = Object.values(db.alumnos).map((a) => (
        `<option value="${a.matricula}">${a.matricula} - ${a.nombre} (${a.grado})</option>`
    )).join("");
    const filasAlumnos = Object.values(db.alumnos).map((a) => `
        <tr>
            <td>${a.matricula}</td>
            <td>${a.nombre}</td>
            <td>${a.grado}</td>
            <td>${a.cicloIngreso}</td>
        </tr>
    `).join("");
    const filasArchivoMuerto = (db.archivoMuerto || []).map((baja) => `
        <tr>
            <td>${baja.matricula}</td>
            <td>${baja.nombre}</td>
            <td>${baja.tipoBaja}</td>
            <td>${baja.fechaBaja}</td>
            <td>${baja.motivo}</td>
            <td>${baja.cicloAlMomento}</td>
        </tr>
    `).join("");

    contenido.innerHTML = `
        <h2>🛠️ Administracion</h2>
        <p>Control total para sistemas/control escolar.</p>

        <div class="tramite-card">
            <h3>Crear cuenta (no alumno)</h3>
            <div class="control-form-row">
                <select id="nuevoRolCuenta">
                    <option value="administrador">Administrador</option>
                    <option value="director">Director</option>
                    <option value="prefectura">Prefectura</option>
                    <option value="docente">Docente</option>
                </select>
                <input id="nuevoUsuarioCuenta" type="text" placeholder="Usuario">
                <input id="nuevoNombreCuenta" type="text" placeholder="Nombre visible">
                <input id="nuevoPassCuenta" type="text" placeholder="Contrasena">
                <button onclick="crearCuenta()">Crear cuenta</button>
            </div>
        </div>

        <div class="tramite-card">
            <h3>Alta de alumno nuevo ingreso</h3>
            <div class="control-form-row">
                <input id="nuevoAlumnoMatricula" type="text" placeholder="Matricula">
                <input id="nuevoAlumnoNombre" type="text" placeholder="Nombre completo">
                <input id="nuevoAlumnoCurp" type="text" placeholder="CURP">
                <input id="nuevoAlumnoNacimiento" type="date" placeholder="Fecha de nacimiento">
                <input id="nuevoAlumnoTipoSangre" type="text" placeholder="Tipo de sangre (ej. O+)">
                <input id="nuevoAlumnoAlergias" type="text" placeholder="Alergias">
                <input id="nuevoAlumnoCondiciones" type="text" placeholder="Condiciones medicas">
                <input id="nuevoAlumnoFoto" type="text" placeholder="URL fotografia (opcional)">
                <input id="nuevoAlumnoTutor" type="text" placeholder="Padre/Madre o tutor">
                <input id="nuevoAlumnoCel" type="text" placeholder="Telefono celular">
                <input id="nuevoAlumnoEmergencia" type="text" placeholder="Telefono emergencia">
                <input id="nuevoAlumnoCorreo" type="email" placeholder="Correo electronico">
                <select id="nuevoAlumnoGrado">
                    <option value="1A">1A</option>
                    <option value="1B">1B</option>
                    <option value="2A">2A</option>
                    <option value="2B">2B</option>
                    <option value="3A">3A</option>
                    <option value="3B">3B</option>
                </select>
                <input id="nuevoAlumnoPass" type="text" placeholder="Contrasena">
                <button onclick="altaAlumno()">Dar de alta</button>
            </div>
        </div>

        <div class="tramite-card">
            <h3>Configurar ciclo escolar</h3>
            <div class="control-form-row">
                <input id="nuevoCiclo" type="text" placeholder="Ej. 2026-2027">
                <button onclick="configurarCiclo()">Establecer ciclo activo</button>
            </div>
            <p><b>Ciclo activo:</b> ${db.cicloActivo}</p>
            <p><b>Ciclos registrados:</b> ${db.ciclos.join(", ")}</p>
        </div>

        <div class="tramite-card">
            <h3>Seguridad y respaldos</h3>
            <p>Contraseñas almacenadas con hash SHA-256.</p>
            <p>Respaldo diario: ${obtenerUltimoRespaldoTexto()}.</p>
            <button onclick="forzarRespaldoManual()">Generar respaldo ahora</button>
        </div>

        <div class="tramite-card">
            <h3>Cierre de ciclo escolar</h3>
            <p>Archiva el ciclo actual, promueve alumnos de forma masiva y egresa automaticamente 3° a archivo muerto digital.</p>
            <button onclick="ejecutarTransicionFinCurso()">Ejecutar transicion</button>
        </div>

        <div class="tramite-card">
            <h3>Baja de alumno a archivo muerto digital</h3>
            <div class="control-form-row">
                <select id="bajaMatricula">${opcionesBaja || "<option value=''>Sin alumnos activos</option>"}</select>
                <select id="bajaTipo">
                    <option value="Egresado">Egresado</option>
                    <option value="Traslado">Traslado a otra escuela</option>
                    <option value="Baja administrativa">Baja administrativa</option>
                </select>
                <input id="bajaMotivo" type="text" placeholder="Motivo de baja">
                <input id="bajaObservaciones" type="text" placeholder="Observaciones">
                <button onclick="darBajaAlumno()">Dar de baja</button>
            </div>
        </div>

        <table class="tabla-control">
            <thead>
                <tr>
                    <th>Matricula</th>
                    <th>Alumno</th>
                    <th>Grado</th>
                    <th>Ciclo ingreso</th>
                </tr>
            </thead>
            <tbody>
                ${filasAlumnos}
            </tbody>
        </table>

        <div class="tramite-card">
            <h3>Archivo muerto digital</h3>
            <p>Expedientes dados de baja o egresados conservados por matricula.</p>
            <table class="tabla-control">
                <thead>
                    <tr>
                        <th>Matricula</th>
                        <th>Alumno</th>
                        <th>Tipo de baja</th>
                        <th>Fecha</th>
                        <th>Motivo</th>
                        <th>Ciclo</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasArchivoMuerto || "<tr><td colspan='6'>Sin registros en archivo muerto.</td></tr>"}
                </tbody>
            </table>
        </div>
    `;
}

function renderNotificaciones(contenido) {
    const alumno = sesionActual.rol === "alumno" ? obtenerAlumnoActual() : null;
    const resumen = obtenerResumenGlobal();
    const alertas = sesionActual.rol === "director" ? obtenerAlertasRojas(UMBRAL_ALERTA_REPORTES) : [];

    if (alumno) {
        const pendientes = alumno.cartasCompromiso.filter((c) => !c.autorizada).length;
        contenido.innerHTML = `
            <h2>🔔 Notificaciones</h2>
            <ul>
                <li>Tienes ${alumno.reportesConducta.length} reporte(s) en historial.</li>
                <li>Tienes ${alumno.citatorios.length} citatorio(s) registrado(s).</li>
                <li>Cartas compromiso pendientes de autorizacion: ${pendientes}.</li>
            </ul>
        `;
        return;
    }

    contenido.innerHTML = `
        <h2>🔔 Notificaciones</h2>
        <ul>
            <li>Cartas pendientes por firma directiva: ${resumen.cartasPendientes}.</li>
            <li>Citatorios activos en sistema: ${resumen.totalCitatorios}.</li>
            <li>Reportes de conducta acumulados: ${resumen.totalReportes}.</li>
            ${sesionActual.rol === "director" ? `<li>Alertas rojas activas (>= ${UMBRAL_ALERTA_REPORTES}): ${alertas.length}.</li>` : ""}
        </ul>
    `;
}

function capturarCalificacion() {
    if (!tienePermiso("capturarCalificaciones")) {
        alert("No tienes permiso para capturar calificaciones.");
        return;
    }

    const matricula = sesionActual.rol === "alumno"
        ? sesionActual.matricula
        : document.getElementById("capturaMatricula").value;
    const ciclo = document.getElementById("capturaCiclo")?.value || leerDB().cicloActivo;
    const materia = document.getElementById("capturaMateria").value.trim();
    const periodo = document.getElementById("capturaPeriodo").value;
    const valor = Number(document.getElementById("capturaValor").value);

    if (!materia || Number.isNaN(valor)) {
        alert("Completa materia y calificacion.");
        return;
    }

    const db = leerDB();
    const alumno = db.alumnos[matricula];

    if (!alumno) {
        alert("Alumno no encontrado.");
        return;
    }

    alumno.calificaciones.push({
        ciclo,
        periodo,
        materia,
        valor,
        fecha: fechaHoy(),
        capturadoPor: sesionActual.usuario
    });

    actualizarPromedioHistorialEscolar(alumno, ciclo);

    guardarDB(db);
    alert("Calificacion guardada.");
    mostrar("calificaciones");
}

function registrarReporteConducta() {
    if (!tienePermiso("crearReporteConducta")) {
        alert("No tienes permiso para registrar reportes.");
        return;
    }

    const matricula = sesionActual.rol === "alumno"
        ? sesionActual.matricula
        : document.getElementById("disciplinaMatricula").value;
    const fecha = document.getElementById("disciplinaReporteFecha").value || fechaHoyISO();
    const hora = document.getElementById("disciplinaReporteHora").value || "00:00";
    const motivo = document.getElementById("disciplinaReporteMotivo").value.trim();
    const docenteReporta = document.getElementById("disciplinaReporteDocente").value.trim();
    const descripcionHechos = document.getElementById("disciplinaReporteHechos").value.trim();
    const sancionAplicada = document.getElementById("disciplinaReporteSancion").value.trim();

    if (!motivo || !docenteReporta || !descripcionHechos || !sancionAplicada) {
        alert("Completa fecha/hora, motivo, docente, hechos y sancion aplicada.");
        return;
    }

    const db = leerDB();
    const alumno = db.alumnos[matricula];

    alumno.reportesConducta.push({
        id: `REP-${Date.now()}`,
        fecha,
        hora,
        motivo,
        docenteReporta,
        descripcionHechos,
        sancionAplicada,
        descripcion: descripcionHechos,
        creadoPor: sesionActual.usuario
    });
    alumno.historialDisciplinario.push({
        fecha: fechaHoy(),
        evento: `Reporte de conducta (${motivo}) - ${descripcionHechos}`
    });

    guardarDB(db);
    alert("Reporte guardado.");
    mostrar("disciplina");
}

function programarCitatorio() {
    if (!tienePermiso("programarCitatorio")) {
        alert("No tienes permiso para programar citatorios.");
        return;
    }

    const matricula = document.getElementById("disciplinaMatriculaCita").value;
    const fecha = document.getElementById("disciplinaCitatorioFecha").value;
    const hora = document.getElementById("disciplinaCitatorioHora").value;
    const motivo = document.getElementById("disciplinaCitatorioMotivo").value.trim();
    const area = document.getElementById("disciplinaCitatorioArea").value;

    if (!fecha || !hora || !motivo || !area) {
        alert("Completa fecha, hora, motivo y area que cita.");
        return;
    }

    const db = leerDB();
    const alumno = db.alumnos[matricula];

    alumno.citatorios.push({
        id: `CIT-${Date.now()}`,
        fecha,
        hora,
        motivo,
        area,
        estado: "Programado",
        creadoPor: sesionActual.usuario
    });
    alumno.historialDisciplinario.push({
        fecha: fechaHoy(),
        evento: `Citatorio programado (${area}) - ${motivo}`
    });

    guardarDB(db);
    alert("Citatorio programado.");
    mostrar("disciplina");
}

function crearCartaCompromiso() {
    if (!tienePermiso("crearCartaCompromiso")) {
        alert("No tienes permiso para crear cartas compromiso.");
        return;
    }

    const matricula = document.getElementById("disciplinaMatriculaCarta").value;
    const origen = document.getElementById("disciplinaCartaOrigen").value;
    const motivo = document.getElementById("disciplinaCartaMotivo").value.trim();
    const tipoRegistro = document.getElementById("disciplinaCartaTipoRegistro").value;
    const archivo = document.getElementById("disciplinaCartaArchivo")?.files?.[0];
    const acuerdos = document.getElementById("disciplinaCartaAcuerdos").value.trim();
    const vigencia = document.getElementById("disciplinaCartaVigencia").value;

    if (!motivo) {
        alert("Captura el motivo de la carta compromiso.");
        return;
    }

    if (tipoRegistro === "archivo" && !archivo) {
        alert("Sube el documento escaneado en PDF o imagen.");
        return;
    }

    if (tipoRegistro === "digital" && (!acuerdos || !vigencia)) {
        alert("En registro digital debes capturar acuerdos y vigencia.");
        return;
    }

    const db = leerDB();
    const alumno = db.alumnos[matricula];

    alumno.cartasCompromiso.push({
        id: `CAR-${Date.now()}`,
        fecha: fechaHoy(),
        origen,
        motivo,
        tipoRegistro,
        documentoEscaneado: tipoRegistro === "archivo" ? archivo.name : "",
        acuerdos: tipoRegistro === "digital" ? acuerdos : "",
        vigencia: tipoRegistro === "digital" ? vigencia : "",
        creadaPor: sesionActual.usuario,
        autorizada: false,
        firmaDirector: ""
    });
    alumno.historialDisciplinario.push({
        fecha: fechaHoy(),
        evento: `Carta compromiso (${origen}) - ${motivo}`
    });

    guardarDB(db);
    alert("Carta compromiso creada.");
    mostrar("cartas");
}

function actualizarEstadoCitatorio(matricula, citatorioId) {
    if (!tienePermiso("programarCitatorio")) {
        alert("No tienes permiso para actualizar citatorios.");
        return;
    }

    const estado = document.getElementById(`estadoCit-${citatorioId}`)?.value;

    if (!estado) {
        alert("Selecciona un estado valido.");
        return;
    }

    const db = leerDB();
    const alumno = db.alumnos[matricula];
    const citatorio = alumno.citatorios.find((c) => c.id === citatorioId);

    if (!citatorio) {
        alert("Citatorio no encontrado.");
        return;
    }

    citatorio.estado = estado;
    alumno.historialDisciplinario.push({
        fecha: fechaHoy(),
        evento: `Citatorio actualizado a estado: ${estado}`
    });

    guardarDB(db);
    alert("Estado de citatorio actualizado.");
    mostrar("disciplina");
}

function alternarTipoCarta() {
    const tipo = document.getElementById("disciplinaCartaTipoRegistro")?.value;
    const inputArchivo = document.getElementById("disciplinaCartaArchivo");
    const inputAcuerdos = document.getElementById("disciplinaCartaAcuerdos");
    const inputVigencia = document.getElementById("disciplinaCartaVigencia");

    if (!inputArchivo || !inputAcuerdos || !inputVigencia) {
        return;
    }

    if (tipo === "digital") {
        inputArchivo.style.display = "none";
        inputAcuerdos.style.display = "inline-block";
        inputVigencia.style.display = "inline-block";
        return;
    }

    inputArchivo.style.display = "inline-block";
    inputAcuerdos.style.display = "none";
    inputVigencia.style.display = "none";
}

function autorizarCarta(matricula, cartaId) {
    if (!tienePermiso("autorizarCarta")) {
        alert("No tienes permiso para autorizar cartas.");
        return;
    }

    const db = leerDB();
    const alumno = db.alumnos[matricula];
    const carta = alumno.cartasCompromiso.find((c) => c.id === cartaId);

    if (!carta) {
        alert("Carta no encontrada.");
        return;
    }

    carta.autorizada = true;
    carta.firmaDirector = `${sesionActual.nombre} (${fechaHoy()})`;

    guardarDB(db);
    alert("Carta autorizada digitalmente.");
    mostrar("cartas");
}

async function crearCuenta() {
    if (!tienePermiso("administrarCuentas")) {
        alert("No tienes permiso para crear cuentas.");
        return;
    }

    const rol = document.getElementById("nuevoRolCuenta").value;
    const usuario = document.getElementById("nuevoUsuarioCuenta").value.trim().toLowerCase();
    const nombre = document.getElementById("nuevoNombreCuenta").value.trim();
    const password = document.getElementById("nuevoPassCuenta").value.trim();

    if (!rol || !usuario || !nombre || !password) {
        alert("Completa los campos de la cuenta.");
        return;
    }

    const db = leerDB();
    const existe = db.usuarios.some((u) => u.usuario === usuario);

    if (existe) {
        alert("Ese usuario ya existe.");
        return;
    }

    const passwordHash = await hashPassword(password);
    db.usuarios.push({ rol, usuario, nombre, password: passwordHash });
    guardarDB(db);
    alert("Cuenta creada correctamente.");
    mostrar("gestion");
}

async function altaAlumno() {
    if (!tienePermiso("altaAlumno")) {
        alert("No tienes permiso para alta de alumnos.");
        return;
    }

    const matricula = document.getElementById("nuevoAlumnoMatricula").value.trim().toUpperCase();
    const nombre = document.getElementById("nuevoAlumnoNombre").value.trim();
    const curp = document.getElementById("nuevoAlumnoCurp").value.trim().toUpperCase();
    const fechaNacimiento = document.getElementById("nuevoAlumnoNacimiento").value;
    const tipoSangre = document.getElementById("nuevoAlumnoTipoSangre").value.trim();
    const alergias = document.getElementById("nuevoAlumnoAlergias").value.trim();
    const condicionesMedicas = document.getElementById("nuevoAlumnoCondiciones").value.trim();
    const fotografia = document.getElementById("nuevoAlumnoFoto").value.trim();
    const tutorNombre = document.getElementById("nuevoAlumnoTutor").value.trim();
    const telefonoCelular = document.getElementById("nuevoAlumnoCel").value.trim();
    const telefonoEmergencia = document.getElementById("nuevoAlumnoEmergencia").value.trim();
    const correo = document.getElementById("nuevoAlumnoCorreo").value.trim();
    const grado = document.getElementById("nuevoAlumnoGrado").value;
    const password = document.getElementById("nuevoAlumnoPass").value.trim();

    if (!matricula || !nombre || !curp || !fechaNacimiento || !tutorNombre || !telefonoCelular || !telefonoEmergencia || !correo || !grado || !password) {
        alert("Completa todos los datos obligatorios del perfil integral.");
        return;
    }

    const db = leerDB();

    if (db.alumnos[matricula]) {
        alert("La matricula ya existe.");
        return;
    }

    const passwordHash = await hashPassword(password);

    db.alumnos[matricula] = crearAlumnoBase({
        matricula,
        nombre,
        grado,
        password: passwordHash,
        cicloIngreso: db.cicloActivo,
        datosGenerales: {
            nombreCompleto: nombre,
            curp,
            fechaNacimiento,
            tipoSangre,
            alergias,
            condicionesMedicas,
            fotografia
        },
        contacto: {
            tutorNombre,
            telefonoCelular,
            telefonoEmergencia,
            correo
        }
    });
    guardarDB(db);

    alert("Alumno dado de alta.");
    mostrar("gestion");
}

function configurarCiclo() {
    if (!tienePermiso("administrarCiclos")) {
        alert("No tienes permiso para configurar ciclos.");
        return;
    }

    const ciclo = document.getElementById("nuevoCiclo").value.trim();

    if (!ciclo) {
        alert("Ingresa un ciclo escolar.");
        return;
    }

    const db = leerDB();
    db.cicloActivo = ciclo;

    if (!db.ciclos.includes(ciclo)) {
        db.ciclos.push(ciclo);
    }

    guardarDB(db);
    alert("Ciclo escolar actualizado.");
    mostrar("gestion");
}

function ejecutarTransicionFinCurso() {
    if (!tienePermiso("transicionCurso")) {
        alert("No tienes permiso para transicion de fin de curso.");
        return;
    }

    const db = leerDB();
    const cicloCerrado = db.cicloActivo;
    const cicloNuevo = siguienteCicloEscolar(cicloCerrado);
    let promovidos = 0;
    let egresados = 0;

    Object.keys(db.alumnos).forEach((matricula) => {
        const alumno = db.alumnos[matricula];
        const cicloAnterior = alumno.cicloActual || db.cicloActivo;
        const gradoAnterior = alumno.grado;

        if (alumno.historialEscolar?.[cicloAnterior]) {
            alumno.historialEscolar[cicloAnterior].estado = "Concluido";
            alumno.historialEscolar[cicloAnterior].observaciones = "Ciclo cerrado por proceso masivo";
            actualizarPromedioHistorialEscolar(alumno, cicloAnterior);
        }

        if (obtenerNumeroGrado(gradoAnterior) >= 3) {
            moverAlumnoArchivoMuerto(db, matricula, {
                tipoBaja: "Egresado",
                motivo: "Egreso automatico al cierre de ciclo",
                observaciones: `Egreso desde ${gradoAnterior}`,
                origen: "cierre-ciclo"
            });
            egresados += 1;
            return;
        }

        alumno.grado = siguienteGrado(alumno.grado);
        alumno.cicloActual = cicloNuevo;

        alumno.historialEscolar[cicloNuevo] = {
            grado: alumno.grado === "EGRESADO" ? "EGRESADO" : `${obtenerNumeroGrado(alumno.grado)}°`,
            grupo: obtenerGrupo(alumno.grado),
            estado: "Activo",
            promedio: "Pendiente",
            observaciones: `Promovido desde ${gradoAnterior}`
        };

        alumno.historialDisciplinario.push({
            fecha: fechaHoy(),
            evento: `Promocion de ${gradoAnterior} a ${alumno.grado} en cierre de ciclo`
        });
        promovidos += 1;
    });

    db.cicloActivo = cicloNuevo;
    if (!db.ciclos.includes(cicloNuevo)) {
        db.ciclos.push(cicloNuevo);
    }
    if (!db.bitacoraCierres) {
        db.bitacoraCierres = [];
    }
    db.bitacoraCierres.push({
        fecha: fechaHoy(),
        cicloCerrado,
        cicloNuevo,
        promovidos,
        egresados,
        ejecutadoPor: sesionActual.usuario
    });

    guardarDB(db);
    alert(`Cierre aplicado. Promovidos: ${promovidos}. Egresados enviados a archivo muerto: ${egresados}. Nuevo ciclo activo: ${cicloNuevo}.`);
    mostrar("gestion");
}

function darBajaAlumno() {
    if (!tienePermiso("transicionCurso")) {
        alert("No tienes permiso para dar de baja alumnos.");
        return;
    }

    const matricula = document.getElementById("bajaMatricula")?.value;
    const tipoBaja = document.getElementById("bajaTipo")?.value;
    const motivo = document.getElementById("bajaMotivo")?.value.trim();
    const observaciones = document.getElementById("bajaObservaciones")?.value.trim();

    if (!matricula) {
        alert("Selecciona un alumno para la baja.");
        return;
    }

    if (!motivo) {
        alert("Captura el motivo de la baja.");
        return;
    }

    const db = leerDB();

    if (!db.alumnos[matricula]) {
        alert("El alumno ya no esta en la base activa.");
        return;
    }

    moverAlumnoArchivoMuerto(db, matricula, {
        tipoBaja,
        motivo,
        observaciones,
        origen: "baja-manual"
    });

    guardarDB(db);
    alert("Alumno enviado a archivo muerto digital.");
    mostrar("gestion");
}

function configurarMenuPorRol() {
    const panelUsuario = document.getElementById("panelUsuario");
    const buscadorWrap = document.getElementById("buscadorGlobalWrap");
    const mapaMenu = [
        { id: "menuInfo", permiso: "verExpediente" },
        { id: "menuCalificaciones", permiso: "verCalificaciones" },
        { id: "menuDisciplina", permiso: "verDisciplina" },
        { id: "menuCartas", permiso: "verCartas" },
        { id: "menuEstadisticas", permiso: "verEstadisticas" },
        { id: "menuGestion", permiso: "administracion" }
    ];

    panelUsuario.textContent = sesionActual.rol === "alumno"
        ? `Alumno: ${sesionActual.nombre} (${sesionActual.matricula})`
        : `${textoRol(sesionActual.rol)}: ${sesionActual.nombre}`;

    if (buscadorWrap) {
        const mostrarBuscador = ["prefectura", "director", "administrador"].includes(sesionActual.rol);
        buscadorWrap.style.display = mostrarBuscador ? "block" : "none";
    }

    mapaMenu.forEach((item) => {
        const nodo = document.getElementById(item.id);
        if (!nodo) return;

        if (item.permiso === "administracion") {
            const permiteGestion = tienePermiso("administrarCuentas") || tienePermiso("administrarCiclos") || tienePermiso("transicionCurso") || tienePermiso("altaAlumno");
            nodo.style.display = permiteGestion ? "block" : "none";
            return;
        }

        nodo.style.display = tienePermiso(item.permiso) ? "block" : "none";
    });
}

function inicializarBase() {
    const existente = localStorage.getItem(CLAVE_DB);

    if (existente) {
        return;
    }

    const alumnos = {};

    ALUMNOS_DEMO.forEach((alumno) => {
        alumnos[alumno.matricula] = crearAlumnoBase({
            matricula: alumno.matricula,
            nombre: alumno.nombre,
            grado: alumno.grado,
            password: alumno.password,
            cicloIngreso: "2024-2025"
        });
    });

    const data = {
        cicloActivo: "2025-2026",
        ciclos: ["2024-2025", "2025-2026"],
        usuarios: [...USUARIOS_DEMO],
        alumnos,
        archivoMuerto: [],
        bitacoraCierres: []
    };

    localStorage.setItem(CLAVE_DB, JSON.stringify(data));
}

function migrarEstructuraDB() {
    const db = leerDB();
    let actualizado = false;

    if (!Array.isArray(db.archivoMuerto)) {
        db.archivoMuerto = [];
        actualizado = true;
    }
    if (!Array.isArray(db.bitacoraCierres)) {
        db.bitacoraCierres = [];
        actualizado = true;
    }

    Object.values(db.alumnos).forEach((alumno) => {
        if (!alumno.datosGenerales) {
            alumno.datosGenerales = {
                nombreCompleto: alumno.nombre,
                curp: `CURP${alumno.matricula}XXX0000`,
                fechaNacimiento: "2011-01-15",
                tipoSangre: "O+",
                alergias: "Ninguna",
                condicionesMedicas: "Ninguna",
                fotografia: ""
            };
            actualizado = true;
        }

        if (!alumno.contacto) {
            alumno.contacto = {
                tutorNombre: "Tutor demo",
                telefonoCelular: "5510000000",
                telefonoEmergencia: "5511111111",
                correo: `${alumno.matricula.toLowerCase()}@correo.com`
            };
            actualizado = true;
        }

        if (!alumno.historialEscolar) {
            alumno.historialEscolar = crearHistorialEscolarBase(alumno.cicloIngreso || db.cicloActivo, alumno.grado);
            actualizado = true;
        }

        if (!alumno.cicloActual) {
            alumno.cicloActual = db.cicloActivo;
            actualizado = true;
        }

        (alumno.calificaciones || []).forEach((calif) => {
            if (!calif.ciclo) {
                calif.ciclo = alumno.cicloActual || db.cicloActivo;
                actualizado = true;
            }

            if (calif.periodo === "1er periodo") {
                calif.periodo = "Trimestre I";
                actualizado = true;
            }
            if (calif.periodo === "2do periodo") {
                calif.periodo = "Trimestre II";
                actualizado = true;
            }
            if (calif.periodo === "3er periodo") {
                calif.periodo = "Trimestre III";
                actualizado = true;
            }
        });

        (alumno.reportesConducta || []).forEach((reporte) => {
            if (!reporte.hora) {
                reporte.hora = "00:00";
                actualizado = true;
            }
            if (!reporte.motivo) {
                reporte.motivo = "Conducta";
                actualizado = true;
            }
            if (!reporte.docenteReporta) {
                reporte.docenteReporta = "Sin registrar";
                actualizado = true;
            }
            if (!reporte.descripcionHechos) {
                reporte.descripcionHechos = reporte.descripcion || "Sin descripcion";
                actualizado = true;
            }
            if (!reporte.sancionAplicada) {
                reporte.sancionAplicada = "Sin sancion";
                actualizado = true;
            }
        });

        (alumno.citatorios || []).forEach((citatorio) => {
            if (!citatorio.hora) {
                citatorio.hora = "00:00";
                actualizado = true;
            }
            if (!citatorio.area) {
                citatorio.area = "Prefectura";
                actualizado = true;
            }
            if (!["Programado", "Asistio", "No Asistio"].includes(citatorio.estado)) {
                citatorio.estado = "Programado";
                actualizado = true;
            }
        });

        (alumno.cartasCompromiso || []).forEach((carta) => {
            if (!carta.origen) {
                carta.origen = "Acumulacion de reportes";
                actualizado = true;
            }
            if (!carta.tipoRegistro) {
                carta.tipoRegistro = "digital";
                actualizado = true;
            }
            if (typeof carta.documentoEscaneado === "undefined") {
                carta.documentoEscaneado = "";
                actualizado = true;
            }
            if (typeof carta.acuerdos === "undefined") {
                carta.acuerdos = "";
                actualizado = true;
            }
            if (typeof carta.vigencia === "undefined") {
                carta.vigencia = "";
                actualizado = true;
            }
        });

        obtenerCiclosAlumno(alumno).forEach((ciclo) => {
            actualizarPromedioHistorialEscolar(alumno, ciclo);
        });
    });

    if (actualizado) {
        guardarDB(db);
    }
}

function crearAlumnoBase({ matricula, nombre, grado, password, cicloIngreso, datosGenerales, contacto }) {
    const historialEscolar = crearHistorialEscolarBase(cicloIngreso, grado);

    return {
        matricula,
        nombre,
        grado,
        password,
        cicloIngreso,
        cicloActual: cicloIngreso,
        datosGenerales: {
            nombreCompleto: datosGenerales?.nombreCompleto || nombre,
            curp: datosGenerales?.curp || `CURP${matricula}XXX0000`,
            fechaNacimiento: datosGenerales?.fechaNacimiento || "2011-01-15",
            tipoSangre: datosGenerales?.tipoSangre || "O+",
            alergias: datosGenerales?.alergias || "Ninguna",
            condicionesMedicas: datosGenerales?.condicionesMedicas || "Ninguna",
            fotografia: datosGenerales?.fotografia || ""
        },
        contacto: {
            tutorNombre: contacto?.tutorNombre || "Tutor demo",
            telefonoCelular: contacto?.telefonoCelular || "5510000000",
            telefonoEmergencia: contacto?.telefonoEmergencia || "5511111111",
            correo: contacto?.correo || `${matricula.toLowerCase()}@correo.com`
        },
        historialEscolar,
        historialDisciplinario: [
            { fecha: fechaHoy(), evento: "Registro inicial del expediente" }
        ],
        calificaciones: [
            { ciclo: cicloIngreso, periodo: "Trimestre I", materia: "Matematicas", valor: 9.1, fecha: fechaHoy(), capturadoPor: "docente1" },
            { ciclo: cicloIngreso, periodo: "Trimestre I", materia: "Espanol", valor: 8.8, fecha: fechaHoy(), capturadoPor: "docente1" }
        ],
        reportesConducta: [],
        citatorios: [],
        cartasCompromiso: []
    };
}

function leerDB() {
    return JSON.parse(localStorage.getItem(CLAVE_DB));
}

function guardarDB(data) {
    localStorage.setItem(CLAVE_DB, JSON.stringify(data));
    ejecutarRespaldoDiario(data);
}

function obtenerAlumnoActual() {
    const db = leerDB();
    return db.alumnos[sesionActual.matricula];
}

function obtenerAlumnoObjetivo(selectorId, buscadorId) {
    const db = leerDB();

    if (sesionActual.rol === "alumno") {
        return db.alumnos[sesionActual.matricula];
    }

    const matriculaSelector = document.getElementById(selectorId)?.value;
    if (matriculaSelector && db.alumnos[matriculaSelector]) {
        alumnoSeleccionadoGlobal = matriculaSelector;
        return db.alumnos[matriculaSelector];
    }

    if (alumnoSeleccionadoGlobal && db.alumnos[alumnoSeleccionadoGlobal]) {
        return db.alumnos[alumnoSeleccionadoGlobal];
    }

    if (buscadorId) {
        const filtro = (document.getElementById(buscadorId)?.value || "").trim().toLowerCase();
        if (filtro) {
            const encontrado = Object.values(db.alumnos).find((a) =>
                a.matricula.toLowerCase().includes(filtro) || a.nombre.toLowerCase().includes(filtro)
            );
            if (encontrado) {
                return encontrado;
            }
        }
    }

    const primeraMatricula = Object.keys(db.alumnos)[0];
    return primeraMatricula ? db.alumnos[primeraMatricula] : null;
}

function opcionesAlumno(seleccionado) {
    const db = leerDB();
    return Object.values(db.alumnos).map((a) => (
        `<option value="${a.matricula}" ${seleccionado === a.matricula ? "selected" : ""}>${a.matricula} - ${a.nombre}</option>`
    )).join("");
}

function bloqueSelectorAlumno(id, onChange) {
    return `
        <div class="tramite-card">
            <div class="control-form-row">
                <label for="${id}">Alumno:</label>
                <select id="${id}" onchange="${onChange}">${opcionesAlumno()}</select>
            </div>
        </div>
    `;
}

function obtenerResumenGlobal() {
    const db = leerDB();
    const alumnos = Object.values(db.alumnos);

    return {
        totalAlumnos: alumnos.length,
        totalCalificaciones: alumnos.reduce((acc, a) => acc + a.calificaciones.length, 0),
        totalReportes: alumnos.reduce((acc, a) => acc + a.reportesConducta.length, 0),
        totalCitatorios: alumnos.reduce((acc, a) => acc + a.citatorios.length, 0),
        cartasPendientes: alumnos.reduce((acc, a) => acc + a.cartasCompromiso.filter((c) => !c.autorizada).length, 0),
        cartasAutorizadas: alumnos.reduce((acc, a) => acc + a.cartasCompromiso.filter((c) => c.autorizada).length, 0)
    };
}

function siguienteGrado(grado) {
    const numero = parseInt(grado, 10);
    const grupo = grado.slice(1);

    if (Number.isNaN(numero)) return grado;
    if (numero >= 3) return "EGRESADO";
    return `${numero + 1}${grupo}`;
}

function siguienteCicloEscolar(cicloActual) {
    const partes = (cicloActual || "").split("-").map((x) => Number(x));

    if (partes.length !== 2 || Number.isNaN(partes[0]) || Number.isNaN(partes[1])) {
        const anio = new Date().getFullYear();
        return `${anio}-${anio + 1}`;
    }

    return `${partes[0] + 1}-${partes[1] + 1}`;
}

function moverAlumnoArchivoMuerto(db, matricula, { tipoBaja, motivo, observaciones, origen }) {
    const alumno = db.alumnos[matricula];

    if (!alumno) {
        return;
    }

    const expedienteCompleto = JSON.parse(JSON.stringify(alumno));

    db.archivoMuerto.push({
        id: `BAJA-${Date.now()}-${matricula}`,
        matricula,
        nombre: alumno.nombre,
        gradoAlMomento: alumno.grado,
        cicloAlMomento: alumno.cicloActual || db.cicloActivo,
        tipoBaja,
        motivo,
        observaciones: observaciones || "Sin observaciones",
        fechaBaja: fechaHoy(),
        procesadoPor: sesionActual?.usuario || "sistema",
        origen,
        expediente: expedienteCompleto
    });

    delete db.alumnos[matricula];
}

function obtenerNumeroGrado(grado) {
    const numero = parseInt(grado, 10);
    return Number.isNaN(numero) ? "-" : numero;
}

function obtenerGrupo(grado) {
    if (!grado || grado === "EGRESADO") return "-";
    return grado.slice(1) || "-";
}

function crearHistorialEscolarBase(cicloIngreso, gradoActual) {
    const [inicio] = cicloIngreso.split("-").map((x) => Number(x));
    const gradoNumero = obtenerNumeroGrado(gradoActual);
    const grupo = obtenerGrupo(gradoActual);
    const historial = {};

    if (gradoNumero === "-") {
        historial[cicloIngreso] = {
            grado: "Sin grado",
            grupo: "-",
            estado: "Activo",
            promedio: "N/A",
            observaciones: "Sin datos de grado"
        };
        return historial;
    }

    for (let i = 1; i <= 3; i += 1) {
        const offset = i - gradoNumero;
        const anioInicio = (inicio || 2025) + offset;
        const ciclo = `${anioInicio}-${anioInicio + 1}`;
        historial[ciclo] = {
            grado: `${i}°`,
            grupo,
            estado: i < gradoNumero ? "Concluido" : (i === gradoNumero ? "Activo" : "Proyectado"),
            promedio: i <= gradoNumero ? (8.5 + i * 0.2).toFixed(1) : "Pendiente",
            observaciones: i < gradoNumero ? "Ciclo cerrado" : (i === gradoNumero ? "Cursando" : "Ciclo futuro")
        };
    }

    return historial;
}

function renderSinPermiso(contenido, modulo) {
    contenido.innerHTML = `
        <h2>Acceso restringido</h2>
        <p>No tienes permiso para acceder al modulo de ${modulo}.</p>
    `;
}

function tienePermiso(clave) {
    if (!sesionActual) return false;
    return Boolean(PERMISOS[sesionActual.rol]?.[clave]);
}

function textoRol(rol) {
    if (rol === "administrador") return "Administrador";
    if (rol === "director") return "Director";
    if (rol === "prefectura") return "Prefectura";
    if (rol === "docente") return "Docente";
    return "Alumno";
}

function fechaHoy() {
    const hoy = new Date();
    return hoy.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function fechaHoyISO() {
    const hoy = new Date();
    return hoy.toISOString().slice(0, 10);
}

function obtenerCiclosAlumno(alumno) {
    const set = new Set();

    Object.keys(alumno.historialEscolar || {}).forEach((ciclo) => set.add(ciclo));
    (alumno.calificaciones || []).forEach((c) => {
        if (c.ciclo) set.add(c.ciclo);
    });

    return Array.from(set).sort();
}

function calcularPromedioCiclo(alumno, ciclo) {
    const registros = (alumno.calificaciones || []).filter((c) => c.ciclo === ciclo);
    const total = registros.reduce((acc, c) => acc + Number(c.valor || 0), 0);
    const promedioNumero = registros.length ? total / registros.length : 0;
    const promedio = registros.length ? promedioNumero.toFixed(2) : "Sin datos";
    const reportesConducta = (alumno.reportesConducta || []).filter((r) => obtenerCicloDesdeFecha(r.fecha) === ciclo).length;

    return {
        promedio,
        promedioNumero,
        materias: registros.length,
        reportesConducta
    };
}

function actualizarPromedioHistorialEscolar(alumno, ciclo) {
    if (!alumno.historialEscolar) {
        alumno.historialEscolar = {};
    }

    if (!alumno.historialEscolar[ciclo]) {
        alumno.historialEscolar[ciclo] = {
            grado: `${obtenerNumeroGrado(alumno.grado)}°`,
            grupo: obtenerGrupo(alumno.grado),
            estado: alumno.cicloActual === ciclo ? "Activo" : "Concluido",
            promedio: "Sin datos",
            observaciones: "Registro academico generado automaticamente"
        };
    }

    const promedio = calcularPromedioCiclo(alumno, ciclo).promedio;
    alumno.historialEscolar[ciclo].promedio = promedio;
}

function construirAnalisisRendimientoDisciplinario(alumno) {
    const ciclos = obtenerCiclosAlumno(alumno).sort();

    if (!ciclos.length) {
        return "<p>Sin informacion suficiente para analisis.</p>";
    }

    let html = "<ul>";

    ciclos.forEach((ciclo, index) => {
        const actual = calcularPromedioCiclo(alumno, ciclo);
        const anteriorCiclo = index > 0 ? ciclos[index - 1] : null;
        const anterior = anteriorCiclo ? calcularPromedioCiclo(alumno, anteriorCiclo) : null;

        if (!anterior) {
            html += `<li><b>${ciclo}</b>: promedio ${actual.promedio}, reportes ${actual.reportesConducta}. (Ciclo base de comparacion)</li>`;
            return;
        }

        const caida = anterior.promedioNumero - actual.promedioNumero;
        const aumentoReportes = actual.reportesConducta - anterior.reportesConducta;
        const posibleVinculo = caida >= 0.5 && aumentoReportes > 0;
        const etiqueta = posibleVinculo
            ? "<span class='alerta-riesgo'>Posible vinculo disciplina-rendimiento</span>"
            : "<span class='alerta-estable'>Sin alerta critica</span>";

        html += `
            <li>
                <b>${ciclo}</b>: promedio ${actual.promedio} (antes ${anterior.promedio}), reportes ${actual.reportesConducta} (antes ${anterior.reportesConducta}).
                ${etiqueta}
            </li>
        `;
    });

    html += "</ul>";
    return html;
}

function obtenerCicloDesdeFecha(fechaTexto) {
    const fecha = parseFechaFlexible(fechaTexto);

    if (!fecha) {
        return leerDB().cicloActivo;
    }

    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    const inicio = mes >= 8 ? anio : anio - 1;
    return `${inicio}-${inicio + 1}`;
}

function parseFechaFlexible(texto) {
    if (!texto) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        const fechaIso = new Date(`${texto}T00:00:00`);
        return Number.isNaN(fechaIso.getTime()) ? null : fechaIso;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
        const [dia, mes, anio] = texto.split("/").map(Number);
        const fechaLatam = new Date(anio, mes - 1, dia);
        return Number.isNaN(fechaLatam.getTime()) ? null : fechaLatam;
    }

    const fecha = new Date(texto);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function configurarBuscadorGlobal() {
    const input = document.getElementById("buscadorGlobal");
    const resultados = document.getElementById("buscadorGlobalResultados");

    if (!input || !resultados) {
        return;
    }

    input.value = "";
    resultados.innerHTML = "";
}

function buscarGlobalAlumno() {
    const input = document.getElementById("buscadorGlobal");
    const resultados = document.getElementById("buscadorGlobalResultados");

    if (!input || !resultados || !sesionActual || sesionActual.rol === "alumno") {
        return;
    }

    const termino = input.value.trim().toLowerCase();
    if (!termino) {
        resultados.innerHTML = "";
        return;
    }

    const db = leerDB();
    const encontrados = Object.values(db.alumnos)
        .filter((a) => {
            const nombre = a.nombre.toLowerCase();
            const matricula = a.matricula.toLowerCase();
            const nombreCompleto = (a.datosGenerales?.nombreCompleto || "").toLowerCase();
            return matricula.includes(termino) || nombre.includes(termino) || nombreCompleto.includes(termino);
        })
        .slice(0, 6);

    resultados.innerHTML = encontrados.length
        ? encontrados.map((a) => `
            <button class="item-buscador" onclick="seleccionarAlumnoDesdeBuscador('${a.matricula}')">
                ${a.matricula} - ${a.nombre} (${a.grado})
            </button>
        `).join("")
        : "<div class='item-buscador-vacio'>Sin coincidencias</div>";
}

function seleccionarAlumnoDesdeBuscador(matricula) {
    alumnoSeleccionadoGlobal = matricula;

    const input = document.getElementById("buscadorGlobal");
    const resultados = document.getElementById("buscadorGlobalResultados");
    const db = leerDB();
    const alumno = db.alumnos[matricula];

    if (input && alumno) {
        input.value = `${alumno.matricula} - ${alumno.nombre}`;
    }
    if (resultados) {
        resultados.innerHTML = "";
    }

    mostrar("disciplina");
}

function obtenerAlertasRojas(umbral) {
    const db = leerDB();

    return Object.values(db.alumnos)
        .map((a) => ({
            matricula: a.matricula,
            nombre: a.nombre,
            grado: a.grado,
            reportes: (a.reportesConducta || []).length
        }))
        .filter((a) => a.reportes >= umbral)
        .sort((a, b) => b.reportes - a.reportes);
}

async function migrarCredencialesSeguras() {
    const db = leerDB();
    let actualizado = false;

    for (const usuario of db.usuarios || []) {
        if (!esHashSHA256(usuario.password)) {
            usuario.password = await hashPassword(usuario.password);
            actualizado = true;
        }
    }

    for (const alumno of Object.values(db.alumnos || {})) {
        if (!esHashSHA256(alumno.password)) {
            alumno.password = await hashPassword(alumno.password);
            actualizado = true;
        }
    }

    if (actualizado) {
        guardarDB(db);
    }
}

function esHashSHA256(valor) {
    return typeof valor === "string" && valor.startsWith("sha256:");
}

async function verificarPassword(passwordPlano, hashGuardado) {
    if (!esHashSHA256(hashGuardado)) {
        return passwordPlano === hashGuardado;
    }

    const hashIngresado = await hashPassword(passwordPlano);
    return hashIngresado === hashGuardado;
}

async function hashPassword(texto) {
    if (window.crypto?.subtle && window.TextEncoder) {
        const data = new TextEncoder().encode(texto);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        return `sha256:${hashHex}`;
    }

    return `sha256:${hashFallback(texto)}`;
}

function hashFallback(texto) {
    let h1 = 0xdeadbeef;
    for (let i = 0; i < texto.length; i += 1) {
        h1 = Math.imul(h1 ^ texto.charCodeAt(i), 2654435761);
    }
    return (h1 >>> 0).toString(16).padStart(8, "0");
}

function ejecutarRespaldoDiario(data, forzar = false) {
    const payload = data || leerDB();
    const hoy = fechaHoyISO();
    const raw = localStorage.getItem(CLAVE_BACKUPS);
    const backups = raw ? JSON.parse(raw) : [];
    const existeHoy = backups.some((b) => b.fecha === hoy);

    if (existeHoy && !forzar) {
        return;
    }

    backups.push({
        fecha: hoy,
        timestamp: new Date().toISOString(),
        snapshot: payload
    });

    const ultimos = backups.slice(-30);
    localStorage.setItem(CLAVE_BACKUPS, JSON.stringify(ultimos));
}

function forzarRespaldoManual() {
    ejecutarRespaldoDiario(leerDB(), true);
    alert("Respaldo generado correctamente.");
    mostrar("gestion");
}

function obtenerUltimoRespaldoTexto() {
    const raw = localStorage.getItem(CLAVE_BACKUPS);
    if (!raw) {
        return "Sin respaldos";
    }

    const backups = JSON.parse(raw);
    if (!backups.length) {
        return "Sin respaldos";
    }

    const ultimo = backups[backups.length - 1];
    return `${ultimo.fecha} (${ultimo.timestamp})`;
}
