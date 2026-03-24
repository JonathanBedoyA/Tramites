function login() {
    let user = document.getElementById("usuario").value;
    let pass = document.getElementById("password").value;

    if (user === "admin" && pass === "1234") {
        document.getElementById("login").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
    } else {
        alert("Datos incorrectos");
    }
}

function cerrarSesion() {
    location.reload();
}

function mostrar(seccion) {
    let contenido = document.getElementById("contenido");

    if (seccion === "inicio") {
        contenido.innerHTML = `
            <h2>🏠 Inicio</h2>
            <p>Bienvenido al sistema de gestión escolar de secundaria.</p>
        `;
    }

    if (seccion === "info") {
        contenido.innerHTML = `
            <h2>📊 Información Académica</h2>
            <p>Alumno: Juan Pérez</p>
            <p>Grado: 3°</p>
            <p>Promedio: 9.2</p>
        `;
    }

    if (seccion === "tramites") {
        contenido.innerHTML = `
            <h2>📄 Trámites Escolares</h2>
            <button onclick="alert('Solicitud enviada')">Inscripción</button>
            <button onclick="alert('Solicitud enviada')">Reinscripción</button>
            <button onclick="alert('Solicitud enviada')">Cambio de grupo</button>
        `;
    }

    if (seccion === "documentos") {
        contenido.innerHTML = `
            <h2>📁 Documentos</h2>
            <button onclick="alert('Constancia solicitada')">Constancia de estudios</button>
            <button onclick="alert('Boleta descargada')">Boleta de calificaciones</button>
        `;
    }

    if (seccion === "notificaciones") {
        contenido.innerHTML = `
            <h2>🔔 Notificaciones</h2>
            <ul>
                <li>📢 Inscripciones abiertas</li>
                <li>📢 Entrega de boletas mañana</li>
                <li>📢 Pago pendiente</li>
            </ul>
        `;
    }
}