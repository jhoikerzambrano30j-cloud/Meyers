/* ============================================================
   PANEL DE ADMINISTRACIÓN
   - Propiedades: crear / editar / borrar + subida de fotos (WebP)
   - Usuarios: registrar y exportar (correo + teléfono)
   ============================================================ */
'use strict';

/* La lista de tipos vive en config.js (window.APP_CONFIG.tiposPropiedad)
   para que el catálogo y el panel usen exactamente los mismos. */
const CARACTERISTICAS_DEFAULT = [
    'PISCINA', 'JARDÍN', 'ESTACIONAMIENTO', 'AIRE ACONDICIONADO', 'SEGURIDAD 24/7',
    'ASCENSOR', 'BALCÓN', 'TERRAZA', 'PLANTA ELÉCTRICA', 'AMOBLADO',
    'COCINA INTEGRAL', 'LAVANDERÍA', 'GIMNASIO', 'ÁREA SOCIAL', 'CÁMARAS DE SEGURIDAD',
    'CISTERNA', 'JACUZZI', 'VISTA PANORÁMICA'
];

let currentUser = null;
let currentProfile = null;
let imagenes = [];       // [{ url, path, blob? }]
let editandoId = null;
let codigoOriginal = '';          // código/ticket original al editar (no cambia)
let guardandoPropiedad = false;   // evita guardados dobles
let cacheUsuarios = [];
let cacheAsesores = [];
let cachePropiedades = [];
let asesorFoto = null;
let asesorPathsViejos = [];
let aboutImagen = null;
let aboutPathsViejos = [];
let heroImagen = null;
let heroPathsViejos = [];
let cacheServicios = [];

/* ---------- Utilidades ---------- */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US');
const fecha = (iso) => iso ? new Date(iso).toLocaleDateString('es-VE', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

/** Aviso elegante (toast) con el estilo de la marca. */
function toast(mensaje, tipo) {
    let cont = document.getElementById('toastContainer');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'toastContainer';
        cont.className = 'toast-container';
        cont.setAttribute('role', 'status');
        cont.setAttribute('aria-live', 'polite');
        document.body.appendChild(cont);
    }

    const texto = String(mensaje || '');
    const esError = tipo === 'error' ||
        (/error|no se pudo|no se pudieron|no hay|ya existe|supera|ignoraron|primero/i.test(texto) && tipo !== 'success');
    const clase = tipo === 'success' ? 'success' : (esError ? 'error' : 'info');
    const icono = clase === 'error' ? 'fa-circle-exclamation' : clase === 'success' ? 'fa-circle-check' : 'fa-circle-info';

    const el = document.createElement('div');
    el.className = 'toast ' + clase;
    el.innerHTML = `<i class="fas ${icono}" aria-hidden="true"></i><span>${esc(texto)}</span>`;
    cont.appendChild(el);

    setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 260);
    }, clase === 'error' ? 4600 : 3600);
}

/** Copia texto al portapapeles con respaldo para navegadores sin permiso. */
async function copiarAlPortapapeles(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch (e) {
        const area = document.createElement('textarea');
        area.value = texto;
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        area.remove();
        return ok;
    }
}

/** Muestra un elemento con una animación suave (y la reinicia cada vez). */
function mostrarConAnimacion(el) {
    if (!el) return;
    el.style.display = 'block';
    el.classList.remove('anim-in');
    void el.offsetWidth; // reflow para reiniciar la animación
    el.classList.add('anim-in');
}

function setStatus(el, msg, tipo) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'alert show ' + (tipo === 'error' ? 'alert-error' : tipo === 'success' ? 'alert-success' : 'alert-info');
}

/** Modal de confirmación con OK / Cancelar. Devuelve true si el usuario acepta. */
function confirmar(titulo, mensaje, textoOk) {
    return new Promise((resolve) => {
        const overlay = $('#confirmOverlay');
        if (!overlay) { resolve(window.confirm(mensaje)); return; }

        $('#confirmTitle').textContent = titulo;
        $('#confirmMsg').textContent = mensaje;
        $('#confirmOk').textContent = textoOk || 'Sí, continuar';

        overlay.hidden = false;
        requestAnimationFrame(() => overlay.classList.add('active'));

        const cerrar = () => {
            overlay.classList.remove('active');
            setTimeout(() => { overlay.hidden = true; }, 200);
            $('#confirmOk').removeEventListener('click', onOk);
            $('#confirmCancel').removeEventListener('click', onNo);
            overlay.removeEventListener('click', onOverlay);
            document.removeEventListener('keydown', onKey);
        };
        const onOk = () => { cerrar(); resolve(true); };
        const onNo = () => { cerrar(); resolve(false); };
        const onOverlay = (e) => { if (e.target === overlay) onNo(); };
        const onKey = (e) => { if (e.key === 'Escape') onNo(); };

        $('#confirmOk').addEventListener('click', onOk);
        $('#confirmCancel').addEventListener('click', onNo);
        overlay.addEventListener('click', onOverlay);
        document.addEventListener('keydown', onKey);
    });
}

function exportCSV(rows, filename) {
    if (!rows || !rows.length) { toast('No hay datos para exportar.'); return; }
    const headers = Object.keys(rows[0]);
    const line = (r) => headers.map((h) => {
        const v = (r[h] == null ? '' : String(r[h])).replace(/"/g, '""');
        return /[";\n]/.test(v) ? `"${v}"` : v;
    }).join(';');
    const csv = [headers.join(';')].concat(rows.map(line)).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/* ============================================================
   INICIO
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    if (!window.isSupabaseReady()) {
        document.body.innerHTML =
            '<div style="max-width:640px;margin:120px auto;padding:30px;font-family:sans-serif;text-align:center;">' +
            '<h2>Falta configurar Supabase</h2>' +
            '<p>Abre <b>config.js</b> y pega tu <b>Project URL</b> y tu <b>anon key</b>.</p></div>';
        return;
    }

    const session = await Auth.requireAdmin();
    if (!session) return;

    currentUser = session.user;
    currentProfile = session.profile;
    Auth.initIdleLogout(10);

    const nameEl = $('#adminName');
    if (nameEl) nameEl.textContent = currentProfile.full_name || currentUser.email;

    $('#logoutBtnAdmin')?.addEventListener('click', () => Auth.signOut());

    initTabs();
    poblarTiposAdmin();
    initPropertyForm();
    initUbicaciones();
    initMayusculas();
    initCaracteristicas();
    initAyudas();
    $('#btnNewProperty')?.addEventListener('click', () => openForm(null));
    $('#btnCancelForm')?.addEventListener('click', closeForm);
    $('#btnExportUsers')?.addEventListener('click', () => exportUsuarios());
    $('#btnNewAsesor')?.addEventListener('click', () => openAsesorForm(null));
    $('#btnCancelAsesor')?.addEventListener('click', closeAsesorForm);
    initAsesorForm();
    initAboutForm();
    initSitioForm();
    initSeccionesForm();
    initServiciosAdmin();
    $('#asesor')?.addEventListener('change', actualizarCodigoPreview);
    $('#btnCopyReviewLink')?.addEventListener('click', copiarLinkResena);
    $('#btnReviewWhatsapp')?.addEventListener('click', compartirWhatsappResena);

    await Promise.all([
        loadProperties(), loadUsuarios(), cargarAsesores(), loadResenas(),
        cargarAbout(), cargarSitioAdmin(), cargarSeccionesAdmin(), cargarServiciosAdmin()
    ]);

    // Limpieza automática del historial: se borran los tratos con más de 2 meses
    if (await limpiarHistorial()) await loadProperties();
});

/* ============================================================
   PESTAÑAS
   ============================================================ */
function initTabs() {
    $$('.admin-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            const destino = tab.dataset.tab;
            const activa = $$('.admin-tab').find((t) => t.classList.contains('active'));
            const origen = activa ? activa.dataset.tab : null;

            // Al salir de una pestaña, cerrar su formulario y volver a la lista
            if (origen && origen !== destino) {
                if (origen === 'propiedades') closeForm();
                if (origen === 'asesores') closeAsesorForm();
            }

            $$('.admin-tab').forEach((t) => t.classList.remove('active'));
            $$('.admin-panel').forEach((p) => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById('tab-' + destino);
            if (panel) panel.classList.add('active');
            if (destino === 'metricas') renderMetricas();
            if (destino === 'historial') renderHistorial();
            if (destino === 'resenas') loadResenas();
            if (destino === 'nosotros') cargarAbout();
            if (destino === 'sitio') cargarSitioAdmin();
            if (destino === 'secciones') cargarSeccionesAdmin();
            if (destino === 'servicios') cargarServiciosAdmin();
        });
    });
}

/* ============================================================
   PROPIEDADES
   ============================================================ */
async function loadProperties() {
    const tbody = $('#propertiesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7"><div class="spinner"></div></td></tr>';

    const { data, error } = await window.db
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7">Error: ${esc(error.message)}</td></tr>`;
        return;
    }

    cachePropiedades = data || [];

    const total = $('#propertiesCount');
    if (total) total.textContent = data.length + (data.length === 1 ? ' propiedad' : ' propiedades');

    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><i class="fas fa-house"></i><p>Aún no hay propiedades. Crea la primera.</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map((p) => `
        <tr>
            <td>${p.imagen ? `<img class="table-thumb" src="${esc(p.imagen)}" alt="" loading="lazy" decoding="async">` : '<div class="table-thumb"></div>'}</td>
            <td><strong>${esc(p.codigo || '—')}</strong></td>
            <td>${esc(p.titulo)}<br><small style="color:#888">${esc(p.operacion || 'Venta')} · ${esc(p.tipo)} · ${esc(p.ubicacion)}</small></td>
            <td>${money(p.precio)}</td>
            <td>${p.destacada ? '<span style="color:#1e8e4e;font-weight:700">Sí</span>' : 'No'}</td>
            <td>${fecha(p.created_at)}</td>
            <td>
                <div class="cell-actions">
                    <select class="estado-select" data-estado="${esc(p.id)}" title="Cambiar estado">
                        <option value="Disponible" ${(!p.estado || p.estado === 'Disponible') ? 'selected' : ''}>Disponible</option>
                        <option value="Vendida" ${p.estado === 'Vendida' ? 'selected' : ''}>Vendida</option>
                        <option value="Alquilada" ${p.estado === 'Alquilada' ? 'selected' : ''}>Alquilada</option>
                        <option value="Acordado" ${p.estado === 'Acordado' ? 'selected' : ''}>Acordado</option>
                    </select>
                    <button class="btn-sm btn-edit" data-edit="${p.id}"><i class="fas fa-pen"></i> Editar</button>
                    <button class="btn-sm btn-danger" data-del="${p.id}"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit]').forEach((b) =>
        b.addEventListener('click', () => openForm(b.dataset.edit, data)));
    tbody.querySelectorAll('[data-del]').forEach((b) =>
        b.addEventListener('click', () => borrarPropiedad(b.dataset.del)));
    tbody.querySelectorAll('[data-estado]').forEach((sel) =>
        sel.addEventListener('change', () => cambiarEstado(sel.dataset.estado, sel.value)));
}

/** Llena el select de tipos con la lista predeterminada de config.js. */
function poblarTiposAdmin() {
    const sel = $('#tipo');
    if (!sel) return;
    const tipos = (window.APP_CONFIG && window.APP_CONFIG.tiposPropiedad) || [];
    if (!tipos.length) return; // deja las opciones del HTML como respaldo

    sel.innerHTML = '<option value="">Selecciona…</option>' +
        tipos.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
}

/** Conserva tipos antiguos que ya no estén en la lista. */
function asegurarTipoOpcion(tipo) {
    const sel = $('#tipo');
    if (!sel || !tipo) return;
    if (!Array.from(sel.options).some((o) => o.value === tipo)) {
        const opt = document.createElement('option');
        opt.value = tipo;
        opt.textContent = tipo;
        sel.appendChild(opt);
    }
}

function initPropertyForm() {
    const form = $('#propertyForm');
    if (!form) return;

    form.addEventListener('submit', guardarPropiedad);
    const input = $('#imagenInput');
    const uploader = $('#uploader');
    if (uploader && input) {
        uploader.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => agregarArchivos(e.target.files));
        ['dragenter', 'dragover'].forEach((ev) =>
            uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach((ev) =>
            uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.remove('dragover'); }));
        uploader.addEventListener('drop', (e) => agregarArchivos(e.dataTransfer.files));
    }
}

/* ---------- Ciudades y Zonas (listas libres, SIN relación) ---------- */
let ciudadesPorNombre = new Map();   // nombre -> id
let zonasTodas = [];                 // todas las zonas (sin ciudad)

function initUbicaciones() {
    const btnCiudad = $('#btnAddCiudad');
    const btnZona = $('#btnAddZona');

    if (btnCiudad) btnCiudad.addEventListener('click', agregarCiudad);
    if (btnZona) btnZona.addEventListener('click', agregarZona);

    cargarCiudades();
    cargarZonas();
}

async function cargarCiudades() {
    const list = $('#ciudadesList');
    const { data, error } = await window.db.from('locations').select('id, nombre').order('nombre');
    if (error) { toast('No se pudieron cargar las ciudades: ' + error.message); return; }
    ciudadesPorNombre = new Map((data || []).map((c) => [c.nombre, c.id]));
    if (list) list.innerHTML = (data || []).map((c) => `<option value="${esc(c.nombre)}"></option>`).join('');
}

async function cargarZonas() {
    const list = $('#zonasList');
    const inputZona = $('#zona');
    const { data, error } = await window.db.from('zonas').select('nombre').order('nombre');
    if (error) { zonasTodas = []; return; }
    zonasTodas = (data || []).map((z) => z.nombre);
    if (list) list.innerHTML = zonasTodas.map((z) => `<option value="${esc(z)}"></option>`).join('');
    if (inputZona) inputZona.placeholder = zonasTodas.length ? 'ESCRIBE O ELIGE…' : 'ESCRIBE LA PRIMERA ZONA';
}

async function agregarCiudad() {
    const input = $('#ubicacion');
    const nombre = (input.value || '').trim().toUpperCase();
    if (!nombre) { toast('Escribe una ciudad primero.'); return; }
    if (ciudadesPorNombre.has(nombre)) {
        input.value = nombre;
        toast('La ciudad "' + nombre + '" ya existe.');
        return;
    }
    const { error } = await window.db.from('locations').insert({ nombre });
    if (error) { toast('No se pudo agregar la ciudad: ' + error.message); return; }
    await cargarCiudades();
    input.value = nombre;
    toast('Ciudad "' + nombre + '" agregada.');
}

async function agregarZona() {
    const inputZona = $('#zona');
    const zona = (inputZona.value || '').trim().toUpperCase();
    if (!zona) { toast('Escribe la zona que quieres agregar.'); return; }

    if (zonasTodas.includes(zona)) {
        inputZona.value = zona;
        toast('La zona "' + zona + '" ya existe.');
        return;
    }

    const { error } = await window.db.from('zonas').insert({ nombre: zona });
    if (error) { toast('No se pudo agregar la zona: ' + error.message); return; }
    await cargarZonas();
    inputZona.value = zona;
    toast('Zona "' + zona + '" agregada.');
}

/** Pone en MAYÚSCULAS todos los campos marcados con data-upper. */
function initMayusculas() {
    $$('[data-upper]').forEach((el) => {
        el.addEventListener('input', () => {
            const pos = el.selectionStart;
            el.value = el.value.toUpperCase();
            try { el.setSelectionRange(pos, pos); } catch (e) { /* ignorar */ }
        });
    });
}

/* ---------- Características (checks) ---------- */
function renderCaracteristicas(seleccionadas) {
    const box = $('#caracteristicasBox');
    if (!box) return;
    const sel = (seleccionadas || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
    const extras = sel.filter((s) => !CARACTERISTICAS_DEFAULT.includes(s));
    const opciones = CARACTERISTICAS_DEFAULT.concat(extras);
    box.innerHTML = opciones.map((c) => `
        <label class="check-item">
            <input type="checkbox" value="${esc(c)}" ${sel.includes(c) ? 'checked' : ''}>
            <span>${esc(c)}</span>
        </label>`).join('');
}

function initCaracteristicas() {
    const btn = $('#btnAddCaracteristica');
    const input = $('#nuevaCaracteristica');
    if (!btn || !input) return;

    const agregar = () => {
        const valor = (input.value || '').trim().toUpperCase();
        if (!valor) return;
        const box = $('#caracteristicasBox');
        const existente = Array.from(box.querySelectorAll('input')).find((c) => c.value === valor);
        if (existente) {
            existente.checked = true;
        } else {
            const label = document.createElement('label');
            label.className = 'check-item';
            label.innerHTML = '<input type="checkbox" value="' + esc(valor) + '" checked><span>' + esc(valor) + '</span>';
            box.appendChild(label);
        }
        input.value = '';
    };

    btn.addEventListener('click', agregar);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } });
}

async function openForm(id, lista) {
    editandoId = id || null;
    const pLista = (lista || []).find((x) => x.id === editandoId);
    codigoOriginal = pLista ? (pLista.codigo || '') : '';
    const form = $('#propertyForm');
    form.reset();
    imagenes = [];
    await cargarZonas();

    const card = $('#formCard');
    mostrarConAnimacion(card);
    $('#formTitle').textContent = editandoId ? 'Editar propiedad' : 'Nueva propiedad';
    const btnNueva = $('#btnNewProperty');
    if (btnNueva) btnNueva.disabled = true;
    setStatus($('#formStatus'), '', '');
    renderThumbs();
    renderCaracteristicas([]);

    if (editandoId) {
        const p = (lista || []).find((x) => x.id === editandoId) || {};
        // Respaldo: si no vino en la lista, la buscamos
        if (!p.id) return cargarYEditar(editandoId);

        $('#propId').value = p.id || '';
        codigoOriginal = p.codigo || codigoOriginal || '';
        asegurarOpcionAsesor(p.asesor_id);
        $('#asesor').value = p.asesor_id || '';
        $('#codigo').value = codigoOriginal;
        $('#titulo').value = p.titulo || '';
        $('#operacion').value = p.operacion || '';
        asegurarTipoOpcion(p.tipo);
        $('#tipo').value = p.tipo || '';
        $('#ubicacion').value = p.ubicacion || '';
        await cargarZonas();
        $('#zona').value = p.zona || '';
        $('#precio').value = p.precio || '';
        $('#habitaciones').value = p.habitaciones || 0;
        $('#banos').value = p.banos || 0;
        $('#area').value = p.area || 0;
        $('#descripcion').value = p.descripcion || '';
        renderCaracteristicas(p.caracteristicas || []);
        $('#badge').value = p.badge || '';
        $('#badgeClass').value = p.badge_class || '';
        $('#destacada').checked = Boolean(p.destacada);

        cargarImagenesDePropiedad(p.id, p.imagen);
    } else {
        $('#propId').value = '';
        codigoOriginal = '';
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

async function cargarYEditar(id) {
    const { data } = await window.db.from('properties').select('*').eq('id', id).maybeSingle();
    if (data) openForm(id, [data]);
}

async function cargarImagenesDePropiedad(propertyId, portada) {
    const { data } = await window.db.from('property_images')
        .select('*').eq('property_id', propertyId).order('sort_order', { ascending: true });

    imagenes = (data || []).map((i) => ({ url: i.url, path: i.path, thumb: i.thumb, thumb_path: i.thumb_path }));

    // Si no hay galería pero sí portada, la mostramos
    if (!imagenes.length && portada) imagenes = [{ url: portada, path: null }];
    renderThumbs();
}

function agregarArchivos(fileList) {
    const MAX_MB = 15;
    const todos = Array.from(fileList || []);
    const noImagen = todos.filter((f) => !f.type.startsWith('image/'));
    const grandes = todos.filter((f) => f.type.startsWith('image/') && f.size > MAX_MB * 1024 * 1024);
    const files = todos.filter((f) => f.type.startsWith('image/') && f.size <= MAX_MB * 1024 * 1024);

    if (noImagen.length) toast('Se ignoraron archivos que no son imágenes.');
    if (grandes.length) toast('Estas imágenes superan ' + MAX_MB + ' MB y se ignoraron: ' + grandes.map((f) => f.name).join(', '));
    if (!files.length) return;

    files.forEach((file) => {
        const url = URL.createObjectURL(file);
        imagenes.push({ url, path: null, blob: file, esNueva: true });
    });
    renderThumbs();
}

function renderThumbs() {
    const cont = $('#thumbs');
    if (!cont) return;
    cont.innerHTML = imagenes.map((img, i) => `
        <div class="thumb">
            <img src="${esc(img.thumb || img.url)}" alt="">
            <button type="button" class="thumb-remove" data-remove="${i}" title="Quitar">&times;</button>
            ${i === 0 ? '<span class="thumb-main">Portada</span>' : ''}
        </div>
    `).join('');

    cont.querySelectorAll('[data-remove]').forEach((b) =>
        b.addEventListener('click', () => {
            const img = imagenes[Number(b.dataset.remove)];
            if (img && img.esNueva) URL.revokeObjectURL(img.url);
            imagenes.splice(Number(b.dataset.remove), 1);
            renderThumbs();
        }));
}

async function guardarPropiedad(e) {
    e.preventDefault();
    if (guardandoPropiedad) return;   // evita guardados dobles

    const status = $('#formStatus');
    const btn = $('#propertyForm button[type="submit"]');
    const original = btn.innerHTML;

    const titulo = $('#titulo').value.trim();
    if (!titulo) { setStatus(status, 'El título es obligatorio.', 'error'); return; }

    const ubicacionVal = ($('#ubicacion').value || '').trim().toUpperCase();
    const zonaVal = ($('#zona').value || '').trim().toUpperCase();
    $('#ubicacion').value = ubicacionVal;
    $('#zona').value = zonaVal;

    guardandoPropiedad = true;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        // Asegurar la ciudad y la zona (listas independientes)
        if (ubicacionVal && !ciudadesPorNombre.has(ubicacionVal)) {
            const { data } = await window.db.from('locations').insert({ nombre: ubicacionVal }).select('id').single();
            if (data) ciudadesPorNombre.set(ubicacionVal, data.id);
        }
        if (zonaVal && !zonasTodas.includes(zonaVal)) {
            await window.db.from('zonas').insert({ nombre: zonaVal });
        }

        // 1) Subir las imágenes nuevas (WebP grande + miniatura)
        for (const img of imagenes) {
            if (img.esNueva && img.blob) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo fotos...';
                // Grande (para el detalle)
                const grande = await window.optimizarImagen(img.blob, { maxWidth: 1200, quality: 0.82 });
                const subida = await window.subirImagen(grande);
                // Miniatura (para galería y tarjetas) — mucho más liviana
                const mini = await window.optimizarImagen(img.blob, { maxWidth: 420, quality: 0.7 });
                const subidaMini = await window.subirImagen(mini);

                img.url = subida.url;
                img.path = subida.path;
                img.thumb = subidaMini.url;
                img.thumb_path = subidaMini.path;
                img.esNueva = false;
                img.blob = null;
            }
        }

        const portada = imagenes.length ? imagenes[0].url : null;

        const payload = {
            titulo: titulo.toUpperCase(),
            tipo: $('#tipo').value,
            operacion: $('#operacion').value,
            ubicacion: ubicacionVal,
            zona: zonaVal,
            asesor_id: $('#asesor').value || null,
            precio: Number($('#precio').value || 0),
            habitaciones: Number($('#habitaciones').value || 0),
            banos: Number($('#banos').value || 0),
            area: Number($('#area').value || 0),
            descripcion: $('#descripcion').value.trim(),
            caracteristicas: Array.from(document.querySelectorAll('#caracteristicasBox input[type="checkbox"]:checked')).map((c) => c.value),
            badge: $('#badge').value.trim().toUpperCase() || null,
            badge_class: $('#badgeClass').value.trim() || null,
            imagen: portada,
            imagen_thumb: imagenes.length ? (imagenes[0].thumb || imagenes[0].url) : null,
            destacada: $('#destacada').checked
        };

        let propertyId = $('#propId').value || null;

        if (propertyId) {
            const { error } = await window.db.from('properties').update(payload).eq('id', propertyId);
            if (error) throw error;
        } else {
            // Aviso anti-duplicados: si ya existe una igual, preguntar
            const { data: repetidas } = await window.db.from('properties')
                .select('id')
                .ilike('titulo', payload.titulo)
                .eq('precio', payload.precio)
                .eq('ubicacion', payload.ubicacion)
                .limit(1);

            if (repetidas && repetidas.length) {
                const continuar = await confirmar(
                    'Propiedad parecida',
                    'Ya existe una propiedad con el mismo título, precio y ubicación. ¿Quieres crearla de todas formas?',
                    'Sí, crear'
                );
                if (!continuar) { setStatus(status, 'Guardado cancelado: ya existía una propiedad igual.', 'info'); return; }
            }

            const { data, error } = await window.db.from('properties').insert(payload).select('id').single();
            if (error) throw error;
            propertyId = data.id;
            // Guardamos el id en el formulario: si algo falla después, ya NO se crea otra
            $('#propId').value = propertyId;
        }

        // 2) Reguardar la galería
        //    Recogemos las rutas actuales ANTES de reemplazarlas, para poder
        //    borrar del almacenamiento las fotos que ya no se usan (evita basura).
        const { data: previas } = await window.db.from('property_images').select('path, thumb_path').eq('property_id', propertyId);
        const rutasPrevias = [...new Set((previas || []).flatMap((i) => [i.path, i.thumb_path]).filter(Boolean))];

        await window.db.from('property_images').delete().eq('property_id', propertyId);

        const filas = imagenes.map((img, i) => ({
            property_id: propertyId, url: img.url, path: img.path,
            thumb: img.thumb || null, thumb_path: img.thumb_path || null, sort_order: i
        }));
        if (filas.length) {
            const { error } = await window.db.from('property_images').insert(filas);
            if (error) throw error;
        }

        // Borrar del almacenamiento las fotos huérfanas (grandes y miniaturas)
        const rutasNuevas = filas.flatMap((f) => [f.path, f.thumb_path]).filter(Boolean);
        const sobrantes = rutasPrevias.filter((p) => !rutasNuevas.includes(p));
        if (sobrantes.length) await window.db.storage.from(window.APP_CONFIG.bucket).remove(sobrantes);

        setStatus(status, '¡Propiedad guardada correctamente!', 'success');
        await loadProperties();
        setTimeout(closeForm, 900);
    } catch (err) {
        setStatus(status, 'Error: ' + (err.message || err), 'error');
    } finally {
        guardandoPropiedad = false;
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

async function cambiarEstado(id, estado) {
    if (estado !== 'Disponible') {
        const ok = await confirmar('Cerrar propiedad',
            `¿Marcar esta propiedad como "${estado}"? Saldrá del catálogo público y quedará en el historial.`,
            `Sí, marcar ${estado}`);
        if (!ok) { await loadProperties(); return; } // revertir el selector
    }
    const fecha = estado === 'Disponible' ? null : new Date().toISOString().slice(0, 10);
    const { error } = await window.db.from('properties').update({ estado, fecha_cierre: fecha }).eq('id', id);
    if (error) { toast('Error: ' + error.message); return; }
    await loadProperties();
    renderMetricas();
    renderHistorial();
}

async function borrarPropiedad(id) {
    const ok = await confirmar('Eliminar propiedad', 'Se borrará la propiedad y sus fotos. Esta acción no se puede deshacer.', 'Sí, eliminar');
    if (!ok) return;

    // Recoger las rutas de las fotos ANTES de borrar la propiedad
    const { data: imgs } = await window.db.from('property_images').select('path, thumb_path').eq('property_id', id);
    const rutas = [...new Set((imgs || []).flatMap((i) => [i.path, i.thumb_path]).filter(Boolean))];

    // Borrar la propiedad (sus filas de property_images se borran en cascada)
    const { error } = await window.db.from('properties').delete().eq('id', id);
    if (error) { toast('Error: ' + error.message); return; }

    // Borrar las fotos del almacenamiento (evita archivos huérfanos)
    if (rutas.length) await window.db.storage.from(window.APP_CONFIG.bucket).remove(rutas);

    await loadProperties();
}

function closeForm() {
    const card = $('#formCard');
    if (card) card.style.display = 'none';
    const btnNueva = $('#btnNewProperty');
    if (btnNueva) btnNueva.disabled = false;
    imagenes.forEach((i) => i.esNueva && URL.revokeObjectURL(i.url));
    imagenes = [];
    editandoId = null;
    codigoOriginal = '';
}

/* ============================================================
   USUARIOS REGISTRADOS
   ============================================================ */
async function loadUsuarios() {
    const tbody = $('#usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7"><div class="spinner"></div></td></tr>';

    const { data, error } = await window.db
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7">Error: ${esc(error.message)}</td></tr>`;
        return;
    }

    cacheUsuarios = data || [];
    const admins = cacheUsuarios.filter((u) => u.role === 'admin' || u.role === 'master').length;
    const masters = cacheUsuarios.filter((u) => u.role === 'master').length;
    const bloqueados = cacheUsuarios.filter((u) => u.bloqueado).length;
    const countEl = $('#usersCount');
    if (countEl) countEl.textContent = `${cacheUsuarios.length} usuarios · ${admins} de 5 administradores · ${masters} de 3 master · ${bloqueados} bloqueados`;

    if (!cacheUsuarios.length) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><i class="fas fa-users"></i><p>Todavía no hay usuarios registrados.</p></div></td></tr>';
        return;
    }

    const soloUsuarios = cacheUsuarios.filter((u) => u.role !== 'admin' && u.role !== 'master');
    const lista = $('#usersFilter')?.checked ? soloUsuarios : cacheUsuarios;

    tbody.innerHTML = lista.map((u) => `
        <tr>
            <td>${esc(u.full_name || '—')}</td>
            <td>${esc(u.email || '—')}</td>
            <td>${esc(u.phone || '—')}</td>
            <td>${rolSelect(u)}</td>
            <td>${u.bloqueado ? '<span class="badge-blocked">Bloqueado</span>' : '<span class="badge-active">Activo</span>'}</td>
            <td>${fecha(u.created_at)}</td>
            <td>${accionesUsuario(u)}</td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-role]').forEach((sel) =>
        sel.addEventListener('change', () => cambiarRol(sel)));
    tbody.querySelectorAll('[data-block]').forEach((b) =>
        b.addEventListener('click', () => bloquearUsuario(b.dataset.block, b.dataset.blocked !== 'true')));
    tbody.querySelectorAll('[data-delete]').forEach((b) =>
        b.addEventListener('click', () => eliminarUsuario(b.dataset.delete)));
}

/** Botones de acción por usuario (solo si puedes gestionarlo). */
function accionesUsuario(u) {
    const mail = `<a class="btn-sm btn-edit" href="mailto:${esc(u.email || '')}" title="Enviar correo"><i class="fas fa-envelope"></i></a>`;
    if (!puedeGestionar(u)) return `<div class="cell-actions">${mail}</div>`;
    const bloquear = `<button class="btn-sm ${u.bloqueado ? 'btn-edit' : 'btn-warn'}" data-block="${esc(u.id)}" data-blocked="${u.bloqueado}">
        <i class="fas fa-${u.bloqueado ? 'unlock' : 'ban'}"></i> ${u.bloqueado ? 'Desbloquear' : 'Bloquear'}</button>`;
    const borrar = `<button class="btn-sm btn-danger" data-delete="${esc(u.id)}" title="Eliminar"><i class="fas fa-trash"></i></button>`;
    return `<div class="cell-actions">${mail}${bloquear}${borrar}</div>`;
}

async function bloquearUsuario(id, bloquear) {
    const ok = await confirmar(
        bloquear ? 'Bloquear usuario' : 'Desbloquear usuario',
        bloquear ? 'No podrá iniciar sesión hasta que lo desbloquees.' : 'Volverá a tener acceso al sistema.',
        bloquear ? 'Sí, bloquear' : 'Sí, desbloquear'
    );
    if (!ok) return;
    const { error } = await window.db.rpc('admin_set_blocked', { target_id: id, blocked: bloquear });
    if (error) toast('No se pudo actualizar: ' + error.message);
    await loadUsuarios();
}

async function eliminarUsuario(id) {
    const ok = await confirmar(
        'Eliminar usuario',
        'Se borrará la cuenta definitivamente. Esta acción no se puede deshacer.',
        'Sí, eliminar'
    );
    if (!ok) return;
    const { error } = await window.db.rpc('admin_delete_user', { target_id: id });
    if (error) toast('No se pudo eliminar: ' + error.message);
    await loadUsuarios();
}

/** Selector de rol. No se puede cambiar el master, ni tu propia cuenta,
 *  ni un administrador si tú no eres el master. */
function rolSelect(u) {
    if (u.role === 'master') {
        return '<span class="badge-master"><i class="fas fa-crown"></i> Master</span>';
    }
    if (!puedeGestionar(u)) {
        return u.role === 'admin'
            ? '<span class="badge-admin">Administrador</span>'
            : '<span class="badge-user">Usuario</span>';
    }

    const esMaster = currentProfile && currentProfile.role === 'master';
    const totalMasters = cacheUsuarios.filter((x) => x.role === 'master').length;
    const puedeMaster = esMaster && totalMasters < 3;
    const opcionMaster = esMaster
        ? `<option value="master" ${puedeMaster ? '' : 'disabled'}>Master${puedeMaster ? '' : ' (máx. 3)'}</option>`
        : '';

    return `<select class="role-select" data-role="${esc(u.id)}">
        <option value="user" ${u.role === 'user' ? 'selected' : ''}>Usuario</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option>
        ${opcionMaster}
    </select>`;
}

/** ¿Puedo gestionar (rol / bloquear / eliminar) a este usuario? */
function puedeGestionar(u) {
    if (!currentUser || !currentProfile) return false;
    if (u.id === currentUser.id) return false;                              // no a ti mismo
    if (u.role === 'master') return false;                                  // nunca al master
    if (u.role === 'admin' && currentProfile.role !== 'master') return false; // admins solo los toca el master
    return true;
}

async function cambiarRol(sel) {
    const id = sel.dataset.role;
    const nuevo = sel.value;
    const usuario = cacheUsuarios.find((u) => u.id === id);

    if (nuevo === 'master') {
        const totalMasters = cacheUsuarios.filter((u) => u.role === 'master').length;
        if (totalMasters >= 3) {
            toast('Ya hay 3 usuarios master (el máximo permitido).', 'error');
            await loadUsuarios();
            return;
        }
        const nombre = usuario ? (usuario.full_name || usuario.email || 'este usuario') : 'este usuario';
        const ok = await confirmar(
            'Dar permisos de master',
            `¿Dar permisos de master a ${nombre}? Podrá gestionar todo el sistema.`,
            'Sí, dar master'
        );
        if (!ok) {
            await loadUsuarios();
            return;
        }
    }

    const { error } = await window.db.from('profiles').update({ role: nuevo }).eq('id', id);

    if (error) {
        let msg = error.message;
        if (/3 usuarios master|máximo 3/i.test(msg)) msg = 'Ya hay 3 usuarios master (el máximo permitido).';
        else if (/5 administradores|máximo 5/i.test(msg)) msg = 'Ya hay 5 administradores (el máximo permitido).';
        else if (/solo un master/i.test(msg)) msg = 'Solo un master puede asignar ese rol.';
        toast('No se pudo cambiar el rol: ' + msg, 'error');
    } else if (nuevo === 'master') {
        toast('Permisos de master otorgados.', 'success');
    }

    await loadUsuarios();
}

function exportUsuarios() {
    const filas = cacheUsuarios.map((u) => ({
        Nombre: u.full_name || '',
        Correo: u.email || '',
        Telefono: u.phone || '',
        Rol: u.role || 'user',
        Fecha_registro: fecha(u.created_at)
    }));
    exportCSV(filas, 'usuarios-meyers.csv');
}

/* Filtro de usuarios */
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'usersFilter') loadUsuarios();
});

/* ============================================================
   AYUDAS — botones "?" que explican cada campo
   ============================================================ */
const AYUDAS = [
    ['codigo', 'Se genera solo al guardar con la nomenclatura del asesor (ej. BP-0007). Al editar una propiedad, el código NO cambia.'],
    ['asesor', 'Elige el asesor que hizo la captación. Su nomenclatura se usará en el código de la propiedad.'],
    ['asesorNombre', 'Nombre completo del asesor (ej. Belkis Prada).'],
    ['asesorCodigo', 'Nomenclatura de 2 a 4 letras. Se usa en el código de captación (ej. BP-0007).'],
    ['asesorCargo', 'Su rol (ej. Broker, Asesor Inmobiliario).'],
    ['asesorTelefono', 'Teléfono o WhatsApp de contacto.'],
    ['asesorEmail', 'Correo del asesor.'],
    ['asesorInstagram', 'Usuario de Instagram (ej. @meyers.inmobiliaria).'],
    ['asesorBio', 'Breve descripción. Puedes usar ENTER para separar líneas.'],
    ['titulo', 'Nombre corto y claro de la propiedad. Se guarda en MAYÚSCULAS.'],
    ['tipo', 'Elige el tipo de propiedad en la lista (Casa, Apartamento, Oficina, Galpón, etc.).'],
    ['ubicacion', 'Ciudad. Escribe o elige de la lista. El botón + agrega una ciudad nueva.'],
    ['zona', 'Sector o urbanización. Es una lista libre: escribe o elige. El botón + agrega una zona nueva.'],
    ['precio', 'Precio en dólares (USD). Solo números.'],
    ['area', 'Superficie en metros cuadrados (m²).'],
    ['habitaciones', 'Cantidad de habitaciones. Pon 0 si no aplica.'],
    ['banos', 'Cantidad de baños. Pon 0 si no aplica.'],
    ['descripcion', 'Escribe un resumen y cada detalle en una línea nueva (ENTER). Se mostrará ordenado en la web.'],
    ['caracteristicasBox', 'Marca las que tenga la propiedad. En la web se muestran con ✓.'],
    ['badge', 'Cartelito de color sobre la foto (ej. DESTACADA, NUEVA). Opcional.'],
    ['badgeClass', 'Color del cartelito: Dorado = elegante (ideal para destacadas). Verde = resalta novedades.'],
    ['destacada', 'Las destacadas aparecen primero y en la sección "Propiedades Destacadas".'],
    ['uploader', 'Sube una o varias fotos. Se optimizan solas (quedan rápidas) y se guardan en la nube.']
];

function initAyudas() {
    AYUDAS.forEach(([id, texto]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const field = el.closest('.field') || el.closest('.checkbox-field') || el.parentElement;
        const label = field ? field.querySelector('label') : null;
        if (!label || label.querySelector('.help-btn')) return;
        const wrap = document.createElement('span');
        wrap.className = 'help-wrap';
        wrap.innerHTML = '<button type="button" class="help-btn" aria-label="Ayuda">?</button>' +
            '<span class="help-tip">' + esc(texto) + '</span>';
        label.appendChild(wrap);
    });
}

/* Al tocar "?" (útil en celular) se muestra la explicación */
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.help-btn');
    document.querySelectorAll('.help-tip.show').forEach((t) => {
        if (!btn || t.previousElementSibling !== btn) t.classList.remove('show');
    });
    if (btn) btn.nextElementSibling.classList.toggle('show');
});

/* ============================================================
   ASESORES (nomenclatura de captaciones)
   ============================================================ */
function initAsesorForm() {
    const form = $('#asesorForm');
    if (form) form.addEventListener('submit', guardarAsesor);

    const input = $('#asesorInput');
    const uploader = $('#asesorUploader');
    if (uploader && input) {
        uploader.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => agregarFotoAsesor(e.target.files));
        ['dragenter', 'dragover'].forEach((ev) => uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach((ev) => uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.remove('dragover'); }));
        uploader.addEventListener('drop', (e) => agregarFotoAsesor(e.dataTransfer.files));
    }
}

function agregarFotoAsesor(fileList) {
    const MAX_MB = 15;
    const file = Array.from(fileList || []).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
        toast('La foto supera ' + MAX_MB + ' MB. Usa una imagen más liviana.');
        return;
    }
    if (asesorFoto && asesorFoto.esNueva && asesorFoto.url) URL.revokeObjectURL(asesorFoto.url);
    asesorFoto = { url: URL.createObjectURL(file), path: null, thumb: null, thumb_path: null, blob: file, esNueva: true };
    renderAsesorThumb();
}

function renderAsesorThumb() {
    const cont = $('#asesorThumbs');
    if (!cont) return;
    cont.innerHTML = asesorFoto ? `
        <div class="thumb">
            <img src="${esc(asesorFoto.thumb || asesorFoto.url)}" alt="">
            <button type="button" class="thumb-remove" data-remove-asesor title="Quitar">&times;</button>
        </div>` : '';
    const btn = cont.querySelector('[data-remove-asesor]');
    if (btn) btn.addEventListener('click', () => { asesorFoto = null; renderAsesorThumb(); });
}

/** Muestra el código que se asignará según el asesor elegido. */
function actualizarCodigoPreview() {
    const sel = $('#asesor');
    const codigo = $('#codigo');
    if (!sel || !codigo) return;

    // Al EDITAR, el código/ticket original NO cambia nunca
    if (editandoId) {
        codigo.value = codigoOriginal;
        return;
    }

    const a = cacheAsesores.find((x) => x.id === sel.value);
    if (a) {
        codigo.value = a.codigo + '-' + String((a.contador || 0) + 1).padStart(4, '0');
    } else {
        codigo.value = '';
        codigo.placeholder = 'Se asigna al guardar';
    }
}

/** Asegura que el asesor actual exista en el select (aunque esté inactivo). */
function asegurarOpcionAsesor(id) {
    const sel = $('#asesor');
    if (!sel || !id) return;
    if (Array.from(sel.options).some((o) => o.value === id)) return;

    const a = cacheAsesores.find((x) => x.id === id);
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = a ? `${a.nombre} (${a.codigo})${a.activo ? '' : ' · inactivo'}` : 'Asesor actual';
    sel.appendChild(opt);
}

async function cargarAsesores() {
    const sel = $('#asesor');
    const tbody = $('#asesoresTableBody');
    const { data, error } = await window.db.from('asesores').select('*').order('nombre');
    if (error) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="6">Error: ' + esc(error.message) + '</td></tr>';
        return;
    }
    cacheAsesores = data || [];

    if (sel) {
        const actual = sel.value;
        sel.innerHTML = '<option value="">Selecciona…</option>' +
            cacheAsesores.map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)} (${esc(a.codigo)})${a.activo ? '' : ' · inactivo'}</option>`).join('');
        if (actual) sel.value = actual;
    }

    if (tbody) {
        const countEl = $('#asesoresCount');
        if (countEl) countEl.textContent = cacheAsesores.length + (cacheAsesores.length === 1 ? ' asesor' : ' asesores');

        if (!cacheAsesores.length) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><i class="fas fa-user-tie"></i><p>No hay asesores.</p></div></td></tr>';
        } else {
            tbody.innerHTML = cacheAsesores.map((a) => `
                <tr>
                    <td>
                        <div class="asesor-cell">
                            ${a.foto_thumb || a.foto ? `<img class="asesor-mini" src="${esc(a.foto_thumb || a.foto)}" alt="" loading="lazy" decoding="async">` : '<div class="asesor-mini"></div>'}
                            <span>${esc(a.nombre)}</span>
                        </div>
                    </td>
                    <td><strong>${esc(a.codigo)}</strong></td>
                    <td>${esc(a.cargo || '—')}</td>
                    <td>${a.contador || 0}</td>
                    <td>${a.activo ? '<span class="badge-active">Activo</span>' : '<span class="badge-blocked">Inactivo</span>'}</td>
                    <td>
                        <div class="cell-actions">
                            <button class="btn-sm btn-edit" data-asesor-edit="${esc(a.id)}"><i class="fas fa-pen"></i> Editar</button>
                            <button class="btn-sm ${a.activo ? 'btn-warn' : 'btn-edit'}" data-asesor-toggle="${esc(a.id)}" data-activo="${a.activo}">
                                <i class="fas fa-${a.activo ? 'ban' : 'check'}"></i> ${a.activo ? 'Desactivar' : 'Activar'}
                            </button>
                            <button class="btn-sm btn-danger" data-asesor-del="${esc(a.id)}" title="Eliminar"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');

            tbody.querySelectorAll('[data-asesor-edit]').forEach((b) =>
                b.addEventListener('click', () => openAsesorForm(cacheAsesores.find((x) => x.id === b.dataset.asesorEdit))));
            tbody.querySelectorAll('[data-asesor-toggle]').forEach((b) =>
                b.addEventListener('click', () => toggleAsesor(b.dataset.asesorToggle, b.dataset.activo !== 'true')));
            tbody.querySelectorAll('[data-asesor-del]').forEach((b) =>
                b.addEventListener('click', () => borrarAsesor(b.dataset.asesorDel)));
        }
    }

    actualizarCodigoPreview();
}

function openAsesorForm(a) {
    $('#asesorForm').reset();
    mostrarConAnimacion($('#asesorFormCard'));
    const btnNuevo = $('#btnNewAsesor');
    if (btnNuevo) btnNuevo.disabled = true;
    $('#asesorFormTitle').textContent = a ? 'Editar asesor' : 'Nuevo asesor';
    setStatus($('#asesorStatus'), '', '');
    $('#asesorId').value = a ? a.id : '';
    $('#asesorNombre').value = a ? a.nombre : '';
    $('#asesorCodigo').value = a ? a.codigo : '';
    $('#asesorCargo').value = a ? (a.cargo || '') : '';
    $('#asesorTelefono').value = a ? (a.telefono || '') : '';
    $('#asesorEmail').value = a ? (a.email || '') : '';
    $('#asesorInstagram').value = a ? (a.instagram || '') : '';
    $('#asesorBio').value = a ? (a.bio || '') : '';

    if (a && (a.foto || a.foto_path)) {
        asesorFoto = { url: a.foto, path: a.foto_path, thumb: a.foto_thumb, thumb_path: a.foto_thumb_path };
        asesorPathsViejos = [a.foto_path, a.foto_thumb_path].filter(Boolean);
    } else {
        asesorFoto = null;
        asesorPathsViejos = [];
    }
    renderAsesorThumb();
    $('#asesorFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeAsesorForm() {
    const card = $('#asesorFormCard');
    if (card) card.style.display = 'none';
    const btnNuevo = $('#btnNewAsesor');
    if (btnNuevo) btnNuevo.disabled = false;
    if (asesorFoto && asesorFoto.esNueva && asesorFoto.url) URL.revokeObjectURL(asesorFoto.url);
    asesorFoto = null;
    asesorPathsViejos = [];
}

async function guardarAsesor(e) {
    e.preventDefault();
    const status = $('#asesorStatus');
    const id = $('#asesorId').value || null;
    const nombre = $('#asesorNombre').value.trim();
    const codigo = ($('#asesorCodigo').value || '').trim().toUpperCase();
    if (!nombre || !codigo) { setStatus(status, 'Completa el nombre y la nomenclatura.', 'error'); return; }

    const btn = $('#asesorForm button[type="submit"]');
    const original = btn.innerHTML;
    const reemplazo = asesorFoto && asesorFoto.esNueva;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        if (reemplazo && asesorFoto.blob) {
            const grande = await window.optimizarImagen(asesorFoto.blob, { maxWidth: 800, quality: 0.82 });
            const subida = await window.subirImagen(grande);
            const mini = await window.optimizarImagen(asesorFoto.blob, { maxWidth: 400, quality: 0.7 });
            const subidaMini = await window.subirImagen(mini);
            asesorFoto.url = subida.url;
            asesorFoto.path = subida.path;
            asesorFoto.thumb = subidaMini.url;
            asesorFoto.thumb_path = subidaMini.path;
            asesorFoto.esNueva = false;
            asesorFoto.blob = null;
        }

        const payload = {
            nombre,
            codigo,
            cargo: $('#asesorCargo').value.trim() || null,
            telefono: $('#asesorTelefono').value.trim() || null,
            email: $('#asesorEmail').value.trim() || null,
            instagram: $('#asesorInstagram').value.trim() || null,
            bio: $('#asesorBio').value.trim() || null,
            foto: asesorFoto ? asesorFoto.url : null,
            foto_thumb: asesorFoto ? (asesorFoto.thumb || asesorFoto.url) : null,
            foto_path: asesorFoto ? (asesorFoto.path || null) : null,
            foto_thumb_path: asesorFoto ? (asesorFoto.thumb_path || null) : null
        };

        const { error } = id
            ? await window.db.from('asesores').update(payload).eq('id', id)
            : await window.db.from('asesores').insert(payload);
        if (error) throw error;

        if (reemplazo && asesorPathsViejos.length) {
            await window.db.storage.from(window.APP_CONFIG.bucket).remove(asesorPathsViejos);
        }

        setStatus(status, '¡Asesor guardado!', 'success');
        await cargarAsesores();
        setTimeout(closeAsesorForm, 800);
    } catch (err) {
        const msg = /duplicate|unique/i.test(err.message) ? 'Esa nomenclatura ya existe. Usa otra.' : err.message;
        setStatus(status, 'Error: ' + msg, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

async function toggleAsesor(id, activo) {
    const { error } = await window.db.from('asesores').update({ activo }).eq('id', id);
    if (error) { toast('Error: ' + error.message); return; }
    await cargarAsesores();
}

async function borrarAsesor(id) {
    const ok = await confirmar('Eliminar asesor', 'Sus captaciones se conservan, pero quedarán sin asesor asignado.', 'Sí, eliminar');
    if (!ok) return;
    const a = cacheAsesores.find((x) => x.id === id);
    const rutas = a ? [a.foto_path, a.foto_thumb_path].filter(Boolean) : [];
    const { error } = await window.db.from('asesores').delete().eq('id', id);
    if (error) { toast('Error: ' + error.message); return; }
    if (rutas.length) await window.db.storage.from(window.APP_CONFIG.bucket).remove(rutas);
    await cargarAsesores();
}

/* ============================================================
   NUESTRA HISTORIA (contenido editable)
   ============================================================ */
async function cargarAbout() {
    const form = $('#aboutForm');
    if (!form) return;

    const { data, error } = await window.db
        .from('about_content')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

    if (error) {
        setStatus($('#aboutStatus'), 'Error al cargar: ' + error.message, 'error');
        return;
    }

    const d = data || {};
    $('#aboutTagInput').value = d.tag || 'Nuestra Historia';
    $('#aboutTitleInput').value = d.titulo || "Meyer's Inmobiliaria";
    $('#aboutTextoInput').value = d.texto || '';
    $('#aboutBadgeLabelInput').value = d.badge_label || 'Desde';
    $('#aboutBadgeYearInput').value = d.badge_year || '2020';
    $('#aboutAltInput').value = d.imagen_alt || '';
    $('#stat1NumeroInput').value = d.stat1_numero || '';
    $('#stat1EtiquetaInput').value = d.stat1_etiqueta || '';
    $('#stat2NumeroInput').value = d.stat2_numero || '';
    $('#stat2EtiquetaInput').value = d.stat2_etiqueta || '';
    $('#stat3NumeroInput').value = d.stat3_numero || '';
    $('#stat3EtiquetaInput').value = d.stat3_etiqueta || '';

    if (d.imagen) {
        aboutImagen = { url: d.imagen, path: d.imagen_path, thumb: d.imagen_thumb, thumb_path: d.imagen_thumb_path };
        aboutPathsViejos = [d.imagen_path, d.imagen_thumb_path].filter(Boolean);
    } else {
        aboutImagen = null;
        aboutPathsViejos = [];
    }
    renderAboutThumb();
}

function initAboutForm() {
    const form = $('#aboutForm');
    if (!form) return;

    form.addEventListener('submit', guardarAbout);

    const uploader = $('#aboutUploader');
    const input = $('#aboutInput');
    if (uploader && input) {
        uploader.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => agregarFotoAbout(e.target.files));
        ['dragenter', 'dragover'].forEach((ev) =>
            uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach((ev) =>
            uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.remove('dragover'); }));
        uploader.addEventListener('drop', (e) => agregarFotoAbout(e.dataTransfer.files));
    }
}

function agregarFotoAbout(fileList) {
    const MAX_MB = 15;
    const file = Array.from(fileList || []).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
        toast('La foto supera ' + MAX_MB + ' MB. Usa una imagen más liviana.', 'error');
        return;
    }
    if (aboutImagen && aboutImagen.esNueva && aboutImagen.url) URL.revokeObjectURL(aboutImagen.url);
    aboutImagen = { url: URL.createObjectURL(file), path: null, thumb: null, thumb_path: null, blob: file, esNueva: true };
    renderAboutThumb();
}

function renderAboutThumb() {
    const cont = $('#aboutThumbs');
    if (!cont) return;
    cont.innerHTML = aboutImagen ? `
        <div class="thumb">
            <img src="${esc(aboutImagen.thumb || aboutImagen.url)}" alt="">
            <button type="button" class="thumb-remove" data-remove-about title="Quitar">&times;</button>
        </div>` : '';
    const btn = cont.querySelector('[data-remove-about]');
    if (btn) btn.addEventListener('click', () => { aboutImagen = null; renderAboutThumb(); });
}

async function guardarAbout(e) {
    e.preventDefault();
    const status = $('#aboutStatus');
    const btn = $('#aboutForm button[type="submit"]');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const reemplazo = aboutImagen && aboutImagen.esNueva;

        if (reemplazo && aboutImagen.blob) {
            const grande = await window.optimizarImagen(aboutImagen.blob, { maxWidth: 1000, quality: 0.82 });
            const subida = await window.subirImagen(grande);
            const mini = await window.optimizarImagen(aboutImagen.blob, { maxWidth: 420, quality: 0.7 });
            const subidaMini = await window.subirImagen(mini);
            aboutImagen.url = subida.url;
            aboutImagen.path = subida.path;
            aboutImagen.thumb = subidaMini.url;
            aboutImagen.thumb_path = subidaMini.path;
            aboutImagen.esNueva = false;
            aboutImagen.blob = null;
        }

        const payload = {
            id: 1,
            tag: $('#aboutTagInput').value.trim() || 'Nuestra Historia',
            titulo: $('#aboutTitleInput').value.trim() || "Meyer's Inmobiliaria",
            texto: $('#aboutTextoInput').value.trim(),
            badge_label: $('#aboutBadgeLabelInput').value.trim() || 'Desde',
            badge_year: $('#aboutBadgeYearInput').value.trim() || '2020',
            imagen_alt: $('#aboutAltInput').value.trim() || null,
            stat1_numero: $('#stat1NumeroInput').value.trim() || null,
            stat1_etiqueta: $('#stat1EtiquetaInput').value.trim() || null,
            stat2_numero: $('#stat2NumeroInput').value.trim() || null,
            stat2_etiqueta: $('#stat2EtiquetaInput').value.trim() || null,
            stat3_numero: $('#stat3NumeroInput').value.trim() || null,
            stat3_etiqueta: $('#stat3EtiquetaInput').value.trim() || null,
            updated_at: new Date().toISOString()
        };

        if (aboutImagen) {
            payload.imagen = aboutImagen.url;
            payload.imagen_thumb = aboutImagen.thumb || aboutImagen.url;
            payload.imagen_path = aboutImagen.path || null;
            payload.imagen_thumb_path = aboutImagen.thumb_path || null;
        } else {
            payload.imagen = null;
            payload.imagen_thumb = null;
            payload.imagen_path = null;
            payload.imagen_thumb_path = null;
        }

        const { error } = await window.db.from('about_content').upsert(payload);
        if (error) throw error;

        if ((reemplazo || !aboutImagen) && aboutPathsViejos.length) {
            await window.db.storage.from(window.APP_CONFIG.bucket).remove(aboutPathsViejos);
        }
        aboutPathsViejos = [];

        setStatus(status, '¡Nuestra Historia actualizada!', 'success');
        toast('Nuestra Historia actualizada.', 'success');
        await cargarAbout();
    } catch (err) {
        setStatus(status, 'Error: ' + (err.message || err), 'error');
        toast('No se pudo guardar: ' + (err.message || err), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* ============================================================
   CONTENIDO DEL SITIO (hero, contacto, pie y SEO)
   ============================================================ */
async function cargarSitioAdmin() {
    const form = $('#sitioForm');
    if (!form) return;

    const { data, error } = await window.db
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

    if (error) {
        setStatus($('#sitioStatus'), 'Error al cargar: ' + error.message, 'error');
        return;
    }

    const d = data || {};
    $('#sitioHeroSubtitulo').value = d.hero_subtitulo || '';
    $('#sitioHeroTitulo').value = d.hero_titulo || '';
    $('#sitioHeroSlogan').value = d.hero_slogan || '';
    $('#sitioHeroTexto').value = d.hero_texto || '';
    $('#sitioHeroCta').value = d.hero_cta || '';
    $('#sitioTelefono').value = d.telefono || '';
    $('#sitioWhatsapp').value = d.whatsapp || '';
    $('#sitioEmail').value = d.email || '';
    $('#sitioDireccion').value = d.direccion || '';
    $('#sitioHorario').value = d.horario || '';
    $('#sitioInstagram').value = d.instagram || '';
    $('#sitioFacebook').value = d.facebook || '';
    $('#sitioLinkedin').value = d.linkedin || '';
    $('#sitioFooterDesc').value = d.footer_desc || '';
    $('#sitioSeoTitulo').value = d.seo_titulo || '';
    $('#sitioSeoDescripcion').value = d.seo_descripcion || '';

    if (d.hero_imagen) {
        heroImagen = { url: d.hero_imagen, path: d.hero_imagen_path };
        heroPathsViejos = d.hero_imagen_path ? [d.hero_imagen_path] : [];
    } else {
        heroImagen = null;
        heroPathsViejos = [];
    }
    renderHeroThumb();
}

function initSitioForm() {
    const form = $('#sitioForm');
    if (!form) return;
    form.addEventListener('submit', guardarSitio);

    const uploader = $('#heroUploader');
    const input = $('#heroInput');
    if (uploader && input) {
        uploader.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => agregarFotoHero(e.target.files));
        ['dragenter', 'dragover'].forEach((ev) =>
            uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach((ev) =>
            uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.remove('dragover'); }));
        uploader.addEventListener('drop', (e) => agregarFotoHero(e.dataTransfer.files));
    }
}

function agregarFotoHero(fileList) {
    const MAX_MB = 15;
    const file = Array.from(fileList || []).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
        toast('La foto supera ' + MAX_MB + ' MB. Usa una imagen más liviana.', 'error');
        return;
    }
    if (heroImagen && heroImagen.esNueva && heroImagen.url) URL.revokeObjectURL(heroImagen.url);
    heroImagen = { url: URL.createObjectURL(file), path: null, blob: file, esNueva: true };
    renderHeroThumb();
}

function renderHeroThumb() {
    const cont = $('#heroThumbs');
    if (!cont) return;
    cont.innerHTML = heroImagen ? `
        <div class="thumb">
            <img src="${esc(heroImagen.url)}" alt="">
            <button type="button" class="thumb-remove" data-remove-hero title="Quitar">&times;</button>
        </div>` : '';
    const btn = cont.querySelector('[data-remove-hero]');
    if (btn) btn.addEventListener('click', () => { heroImagen = null; renderHeroThumb(); });
}

async function guardarSitio(e) {
    e.preventDefault();
    const status = $('#sitioStatus');
    const btn = $('#sitioForm button[type="submit"]');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const heroNueva = heroImagen && heroImagen.esNueva;
        if (heroNueva && heroImagen.blob) {
            const grande = await window.optimizarImagen(heroImagen.blob, { maxWidth: 1920, quality: 0.8 });
            const subida = await window.subirImagen(grande);
            heroImagen.url = subida.url;
            heroImagen.path = subida.path;
            heroImagen.esNueva = false;
            heroImagen.blob = null;
        }

        const payload = {
            id: 1,
            hero_subtitulo: $('#sitioHeroSubtitulo').value.trim(),
            hero_titulo: $('#sitioHeroTitulo').value.trim(),
            hero_slogan: $('#sitioHeroSlogan').value.trim(),
            hero_texto: $('#sitioHeroTexto').value.trim(),
            hero_cta: $('#sitioHeroCta').value.trim() || 'Explorar Propiedades',
            hero_imagen: heroImagen ? heroImagen.url : null,
            hero_imagen_path: heroImagen ? (heroImagen.path || null) : null,
            telefono: $('#sitioTelefono').value.trim(),
            whatsapp: $('#sitioWhatsapp').value.replace(/\D/g, ''),
            email: $('#sitioEmail').value.trim(),
            direccion: $('#sitioDireccion').value.trim(),
            horario: $('#sitioHorario').value.trim(),
            instagram: /^https?:\/\//i.test($('#sitioInstagram').value.trim()) ? $('#sitioInstagram').value.trim() : null,
            facebook: /^https?:\/\//i.test($('#sitioFacebook').value.trim()) ? $('#sitioFacebook').value.trim() : null,
            linkedin: /^https?:\/\//i.test($('#sitioLinkedin').value.trim()) ? $('#sitioLinkedin').value.trim() : null,
            footer_desc: $('#sitioFooterDesc').value.trim(),
            seo_titulo: $('#sitioSeoTitulo').value.trim(),
            seo_descripcion: $('#sitioSeoDescripcion').value.trim(),
            updated_at: new Date().toISOString()
        };

        const { error } = await window.db.from('site_settings').upsert(payload);
        if (error) throw error;

        if ((heroNueva || !heroImagen) && heroPathsViejos.length) {
            await window.db.storage.from(window.APP_CONFIG.bucket).remove(heroPathsViejos);
        }
        heroPathsViejos = [];

        setStatus(status, '¡Contenido del sitio actualizado!', 'success');
        toast('Contenido del sitio actualizado.', 'success');
        await cargarSitioAdmin();
    } catch (err) {
        setStatus(status, 'Error: ' + (err.message || err), 'error');
        toast('No se pudo guardar: ' + (err.message || err), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* ============================================================
   TÍTULOS DE LAS SECCIONES
   ============================================================ */
async function cargarSeccionesAdmin() {
    const form = $('#seccionesForm');
    if (!form) return;

    const { data, error } = await window.db.from('site_settings').select('*').eq('id', 1).maybeSingle();
    if (error) {
        setStatus($('#seccionesStatus'), 'Error al cargar: ' + error.message, 'error');
        return;
    }

    const d = data || {};
    $('#secPropTag').value = d.prop_tag || '';
    $('#secPropTitulo').value = d.prop_titulo || '';
    $('#secPropSubtitulo').value = d.prop_subtitulo || '';
    $('#secServTag').value = d.serv_tag || '';
    $('#secServTitulo').value = d.serv_titulo || '';
    $('#secServSubtitulo').value = d.serv_subtitulo || '';
    $('#secTeamTag').value = d.team_tag || '';
    $('#secTeamTitulo').value = d.team_titulo || '';
    $('#secTeamSubtitulo').value = d.team_subtitulo || '';
    $('#secTestTag').value = d.test_tag || '';
    $('#secTestTitulo').value = d.test_titulo || '';
    $('#secTestSubtitulo').value = d.test_subtitulo || '';
    $('#secCtaTag').value = d.cta_tag || '';
    $('#secCtaTitulo').value = d.cta_titulo || '';
    $('#secCtaTexto').value = d.cta_texto || '';
}

function initSeccionesForm() {
    const form = $('#seccionesForm');
    if (!form) return;
    form.addEventListener('submit', guardarSecciones);
}

async function guardarSecciones(e) {
    e.preventDefault();
    const status = $('#seccionesStatus');
    const btn = $('#seccionesForm button[type="submit"]');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const payload = {
            id: 1,
            prop_tag: $('#secPropTag').value.trim(),
            prop_titulo: $('#secPropTitulo').value.trim(),
            prop_subtitulo: $('#secPropSubtitulo').value.trim(),
            serv_tag: $('#secServTag').value.trim(),
            serv_titulo: $('#secServTitulo').value.trim(),
            serv_subtitulo: $('#secServSubtitulo').value.trim(),
            team_tag: $('#secTeamTag').value.trim(),
            team_titulo: $('#secTeamTitulo').value.trim(),
            team_subtitulo: $('#secTeamSubtitulo').value.trim(),
            test_tag: $('#secTestTag').value.trim(),
            test_titulo: $('#secTestTitulo').value.trim(),
            test_subtitulo: $('#secTestSubtitulo').value.trim(),
            cta_tag: $('#secCtaTag').value.trim(),
            cta_titulo: $('#secCtaTitulo').value.trim(),
            cta_texto: $('#secCtaTexto').value.trim(),
            updated_at: new Date().toISOString()
        };

        const { error } = await window.db.from('site_settings').upsert(payload);
        if (error) throw error;

        setStatus(status, '¡Títulos actualizados!', 'success');
        toast('Títulos de las secciones actualizados.', 'success');
        await cargarSeccionesAdmin();
    } catch (err) {
        setStatus(status, 'Error: ' + (err.message || err), 'error');
        toast('No se pudo guardar: ' + (err.message || err), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* ============================================================
   SERVICIOS
   ============================================================ */
async function cargarServiciosAdmin() {
    const tbody = $('#serviciosTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6"><div class="spinner"></div></td></tr>';

    const { data, error } = await window.db
        .from('services')
        .select('*')
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6">Error: ${esc(error.message)}</td></tr>`;
        return;
    }

    cacheServicios = data || [];
    const count = $('#serviciosCount');
    if (count) count.textContent = `${cacheServicios.length} servicio${cacheServicios.length === 1 ? '' : 's'}`;

    if (!cacheServicios.length) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><i class="fas fa-concierge-bell"></i><p>Aún no hay servicios. Crea el primero.</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = cacheServicios.map((s) => `
        <tr>
            <td>${Number(s.orden) || 0}</td>
            <td><i class="fas ${esc(s.icono)}" style="font-size:1.2rem;color:#B8931F"></i></td>
            <td><strong>${esc(s.titulo)}</strong></td>
            <td style="max-width:320px">${esc(s.descripcion)}</td>
            <td>${s.activo ? '<span class="badge-active">Visible</span>' : '<span class="badge-blocked">Oculto</span>'}</td>
            <td>
                <div class="cell-actions">
                    <button class="btn-sm btn-edit" data-serv-edit="${esc(s.id)}"><i class="fas fa-pen"></i> Editar</button>
                    <button class="btn-sm btn-danger" data-serv-del="${esc(s.id)}"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`).join('');

    tbody.querySelectorAll('[data-serv-edit]').forEach((b) =>
        b.addEventListener('click', () => openServicioForm(cacheServicios.find((x) => x.id === b.dataset.servEdit))));
    tbody.querySelectorAll('[data-serv-del]').forEach((b) =>
        b.addEventListener('click', () => borrarServicio(b.dataset.servDel)));
}

function initServiciosAdmin() {
    $('#btnNewServicio')?.addEventListener('click', () => openServicioForm(null));
    $('#btnCancelServicio')?.addEventListener('click', closeServicioForm);
    $('#servicioForm')?.addEventListener('submit', guardarServicio);
}

function openServicioForm(s) {
    const form = $('#servicioForm');
    if (!form) return;
    form.reset();
    mostrarConAnimacion($('#servicioFormCard'));
    const btnNuevo = $('#btnNewServicio');
    if (btnNuevo) btnNuevo.disabled = true;
    $('#servicioFormTitle').textContent = s ? 'Editar servicio' : 'Nuevo servicio';
    setStatus($('#servicioStatus'), '', '');
    $('#servicioId').value = s ? s.id : '';
    $('#servicioIcono').value = s ? (s.icono || 'fa-house') : 'fa-house';
    $('#servicioOrden').value = s ? (s.orden ?? 0) : cacheServicios.length + 1;
    $('#servicioTitulo').value = s ? s.titulo : '';
    $('#servicioDescripcion').value = s ? s.descripcion : '';
    $('#servicioActivo').checked = s ? Boolean(s.activo) : true;
    $('#servicioFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeServicioForm() {
    const card = $('#servicioFormCard');
    if (card) card.style.display = 'none';
    const btn = $('#btnNewServicio');
    if (btn) btn.disabled = false;
}

async function guardarServicio(e) {
    e.preventDefault();
    const status = $('#servicioStatus');
    const id = $('#servicioId').value || null;
    const titulo = $('#servicioTitulo').value.trim();
    const descripcion = $('#servicioDescripcion').value.trim();

    if (!titulo || !descripcion) {
        setStatus(status, 'Completa el título y la descripción.', 'error');
        return;
    }

    const payload = {
        icono: $('#servicioIcono').value || 'fa-house',
        titulo,
        descripcion,
        orden: Number($('#servicioOrden').value || 0),
        activo: $('#servicioActivo').checked
    };

    const btn = $('#servicioForm button[type="submit"]');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const { error } = id
            ? await window.db.from('services').update(payload).eq('id', id)
            : await window.db.from('services').insert(payload);
        if (error) throw error;

        setStatus(status, '¡Servicio guardado!', 'success');
        toast('Servicio guardado.', 'success');
        await cargarServiciosAdmin();
        setTimeout(closeServicioForm, 700);
    } catch (err) {
        setStatus(status, 'Error: ' + (err.message || err), 'error');
        toast('No se pudo guardar: ' + (err.message || err), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

async function borrarServicio(id) {
    const ok = await confirmar('Eliminar servicio', 'Se eliminará esta tarjeta de la web. Esta acción no se puede deshacer.', 'Sí, eliminar');
    if (!ok) return;
    const { error } = await window.db.from('services').delete().eq('id', id);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast('Servicio eliminado.', 'success');
    await cargarServiciosAdmin();
}

/* ============================================================
   RESEÑAS (aprobar antes de publicar)
   ============================================================ */
async function loadResenas() {
    const pendientes = $('#resenasPendientes');
    const aprobadas = $('#resenasAprobadas');
    const rechazadas = $('#resenasRechazadas');
    if (!pendientes || !aprobadas) return;

    pendientes.innerHTML = '<div class="review-empty"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';
    aprobadas.innerHTML = '';
    if (rechazadas) rechazadas.innerHTML = '';

    const { data, error } = await window.db
        .from('testimonials')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        pendientes.innerHTML = `<div class="review-empty">Error: ${esc(error.message)}</div>`;
        return;
    }

    const lista = data || [];
    const pend = lista.filter((r) => r.estado === 'pendiente');
    const apro = lista.filter((r) => r.estado === 'aprobado');
    const rech = lista.filter((r) => r.estado === 'rechazado');

    const count = $('#resenasCount');
    if (count) {
        count.textContent = `${pend.length} pendiente${pend.length === 1 ? '' : 's'} · ${apro.length} publicada${apro.length === 1 ? '' : 's'}`;
    }

    const pc = $('#resenasPendientesCount');
    const ac = $('#resenasAprobadasCount');
    const rc = $('#resenasRechazadasCount');
    if (pc) pc.textContent = `(${pend.length})`;
    if (ac) ac.textContent = `(${apro.length})`;
    if (rc) rc.textContent = `(${rech.length})`;

    const badge = $('#resenasTabBadge');
    if (badge) {
        badge.textContent = pend.length;
        badge.hidden = pend.length === 0;
    }

    pendientes.innerHTML = pend.length
        ? pend.map((r) => reviewCard(r, 'pendiente')).join('')
        : '<div class="review-empty"><i class="fas fa-circle-check"></i> No hay reseñas pendientes.</div>';

    aprobadas.innerHTML = apro.length
        ? apro.map((r) => reviewCard(r, 'aprobado')).join('')
        : '<div class="review-empty"><i class="fas fa-star"></i> Aún no hay reseñas publicadas.</div>';

    if (rechazadas) {
        rechazadas.innerHTML = rech.length
            ? rech.map((r) => reviewCard(r, 'rechazado')).join('')
            : '<div class="review-empty"><i class="fas fa-eye-slash"></i> No hay reseñas rechazadas.</div>';
    }

    [pendientes, aprobadas, rechazadas].filter(Boolean).forEach(bindResenaAcciones);
}

function estrellasAdmin(n) {
    const k = Math.max(1, Math.min(5, Number(n) || 5));
    return '<span>★</span>'.repeat(k) + '<span class="off">★</span>'.repeat(5 - k);
}

function reviewCard(r, modo) {
    const inicial = String(r.nombre || '?').trim().charAt(0).toUpperCase();
    const acciones = {
        pendiente: `
            <button type="button" class="btn-sm btn-gold" data-aprobar="${esc(r.id)}"><i class="fas fa-check"></i> Aprobar</button>
            <button type="button" class="btn-sm btn-danger" data-rechazar="${esc(r.id)}"><i class="fas fa-xmark"></i> Rechazar</button>`,
        aprobado: `
            <button type="button" class="btn-sm btn-edit" data-ocultar="${esc(r.id)}"><i class="fas fa-eye-slash"></i> Ocultar</button>`,
        rechazado: `
            <button type="button" class="btn-sm btn-gold" data-aprobar="${esc(r.id)}"><i class="fas fa-check"></i> Aprobar</button>`
    }[modo] || '';

    return `
        <article class="review-card">
            <div class="review-head">
                <div class="review-avatar">${esc(inicial)}</div>
                <div class="review-meta">
                    <strong>${esc(r.nombre)}</strong>
                    <span class="review-role">${esc(r.rol || 'Cliente')} · ${esc(fecha(r.created_at))}</span>
                </div>
                <div class="review-stars" aria-label="${Number(r.estrellas) || 5} de 5 estrellas">${estrellasAdmin(r.estrellas)}</div>
            </div>
            <p class="review-text">"${esc(r.texto)}"</p>
            <div class="review-actions">
                ${acciones}
                <button type="button" class="btn-sm btn-edit" data-eliminar="${esc(r.id)}"><i class="fas fa-trash"></i> Eliminar</button>
            </div>
        </article>`;
}

function bindResenaAcciones(cont) {
    cont.querySelectorAll('[data-aprobar]').forEach((b) =>
        b.addEventListener('click', () => cambiarEstadoResena(b.dataset.aprobar, 'aprobado')));
    cont.querySelectorAll('[data-rechazar]').forEach((b) =>
        b.addEventListener('click', () => cambiarEstadoResena(b.dataset.rechazar, 'rechazado')));
    cont.querySelectorAll('[data-ocultar]').forEach((b) =>
        b.addEventListener('click', () => cambiarEstadoResena(b.dataset.ocultar, 'rechazado')));
    cont.querySelectorAll('[data-eliminar]').forEach((b) =>
        b.addEventListener('click', () => borrarResena(b.dataset.eliminar)));
}

async function cambiarEstadoResena(id, estado) {
    const { error } = await window.db.from('testimonials').update({ estado }).eq('id', id);
    if (error) { toast('Error: ' + error.message); return; }
    await loadResenas();
}

async function borrarResena(id) {
    const ok = await confirmar('Eliminar reseña', 'Se borrará esta reseña definitivamente. Esta acción no se puede deshacer.', 'Sí, eliminar');
    if (!ok) return;
    const { error } = await window.db.from('testimonials').delete().eq('id', id);
    if (error) { toast('Error: ' + error.message); return; }
    await loadResenas();
}

async function generarEnlaceResena() {
    const { data, error } = await window.db
        .from('review_links')
        .insert({ created_by: currentUser ? currentUser.id : null })
        .select('token')
        .single();

    if (error) throw new Error(error.message);
    return `${window.location.origin}/resena.html?t=${data.token}`;
}

async function copiarLinkResena() {
    try {
        const link = await generarEnlaceResena();
        const ok = await copiarAlPortapapeles(link);
        if (ok) {
            toast('Enlace de un solo uso generado y copiado.', 'success');
        } else {
            toast('Enlace generado: ' + link, 'info');
        }
    } catch (e) {
        toast('No se pudo generar el enlace: ' + e.message, 'error');
    }
}

async function compartirWhatsappResena() {
    try {
        const link = await generarEnlaceResena();
        const texto = '¡Hola! En Meyer\'s Inmobiliaria queremos conocer tu experiencia. Déjanos tu reseña aquí (enlace de un solo uso): ' + link;
        window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
    } catch (e) {
        toast('No se pudo generar el enlace: ' + e.message, 'error');
    }
}

/* ============================================================
   MÉTRICAS (dashboard de ventas y alquileres)
   ============================================================ */
function renderMetricas() {
    const grid = $('#metricsGrid');
    if (!grid) return;

    const props = cachePropiedades || [];
    const ahora = new Date();
    const mismoMes = (fecha) => {
        if (!fecha) return false;
        const d = new Date(fecha);
        return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
    };

    const disponibles = props.filter((p) => !p.estado || p.estado === 'Disponible');
    const vendidas = props.filter((p) => p.estado === 'Vendida');
    const alquiladas = props.filter((p) => p.estado === 'Alquilada');
    const ventasMes = vendidas.filter((p) => mismoMes(p.fecha_cierre));
    const alquileresMes = alquiladas.filter((p) => mismoMes(p.fecha_cierre));

    const tarjetas = [
        ['Total captaciones', props.length, 'fa-house'],
        ['Disponibles', disponibles.length, 'fa-circle-check'],
        ['Vendidas', vendidas.length, 'fa-handshake'],
        ['Alquiladas', alquiladas.length, 'fa-key'],
        ['Ventas del mes', ventasMes.length, 'fa-chart-line'],
        ['Alquileres del mes', alquileresMes.length, 'fa-file-signature']
    ];
    grid.innerHTML = tarjetas.map(([label, valor, icono]) => `
        <div class="metric-card">
            <i class="fas ${icono}" aria-hidden="true"></i>
            <span class="metric-value">${valor}</span>
            <span class="metric-label">${label}</span>
        </div>`).join('');

    // Top de asesores del mes (por cierres del mes)
    const porAsesor = new Map();
    cacheAsesores.forEach((a) => porAsesor.set(a.id, { nombre: a.nombre, cierres: 0, monto: 0 }));
    [...ventasMes, ...alquileresMes].forEach((p) => {
        if (!p.asesor_id) return;
        const e = porAsesor.get(p.asesor_id);
        if (e) { e.cierres += 1; e.monto += Number(p.precio || 0); }
    });
    const top = [...porAsesor.values()].filter((x) => x.cierres > 0)
        .sort((a, b) => b.cierres - a.cierres).slice(0, 3);

    const topEl = $('#topAsesores');
    if (topEl) {
        if (!top.length) {
            topEl.innerHTML = '<div class="empty"><i class="fas fa-trophy"></i><p>Aún no hay cierres este mes.</p></div>';
        } else {
            const medallas = ['🥇', '🥈', '🥉'];
            topEl.innerHTML = top.map((t, i) => `
                <div class="top-row">
                    <span class="top-pos">${medallas[i] || (i + 1)}</span>
                    <strong>${esc(t.nombre)}</strong>
                    <span>${t.cierres} cierre${t.cierres === 1 ? '' : 's'}</span>
                    <span class="top-monto">$${t.monto.toLocaleString('en-US')}</span>
                </div>`).join('');
        }
    }

    // Resumen por asesor
    const tbody = $('#asesoresMetricsBody');
    if (tbody) {
        if (!cacheAsesores.length) {
            tbody.innerHTML = '<tr><td colspan="6">Sin asesores.</td></tr>';
        } else {
            tbody.innerHTML = cacheAsesores.map((a) => {
                const mias = props.filter((p) => p.asesor_id === a.id);
                const disp = mias.filter((p) => !p.estado || p.estado === 'Disponible').length;
                const v = mias.filter((p) => p.estado === 'Vendida').length;
                const al = mias.filter((p) => p.estado === 'Alquilada').length;
                const cierresMes = mias.filter((p) => (p.estado === 'Vendida' || p.estado === 'Alquilada') && mismoMes(p.fecha_cierre)).length;
                return `<tr>
                    <td>${esc(a.nombre)} <small style="color:#888">(${esc(a.codigo)})</small></td>
                    <td>${a.contador || mias.length}</td>
                    <td>${disp}</td>
                    <td>${v}</td>
                    <td>${al}</td>
                    <td><strong>${cierresMes}</strong></td>
                </tr>`;
            }).join('');
        }
    }

    const mesEl = $('#metricasMes');
    if (mesEl) mesEl.textContent = 'Resumen de ' + ahora.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
}

/* ============================================================
   HISTORIAL DE TRATOS CERRADOS
   ============================================================ */
function estadoBadge(estado) {
    const clase = estado === 'Vendida' ? 'badge-blocked'
        : estado === 'Alquilada' ? 'badge-admin'
            : estado === 'Acordado' ? 'badge-user'
                : 'badge-active';
    return `<span class="${clase}">${esc(estado)}</span>`;
}

function renderHistorial() {
    const tbody = $('#historialTableBody');
    if (!tbody) return;

    const cerradas = (cachePropiedades || []).filter((p) => p.estado && p.estado !== 'Disponible');
    const countEl = $('#historialCount');
    if (countEl) countEl.textContent = cerradas.length + (cerradas.length === 1 ? ' trato cerrado' : ' tratos cerrados');

    if (!cerradas.length) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><i class="fas fa-clock-rotate-left"></i><p>No hay tratos cerrados en los últimos 2 meses.</p></div></td></tr>';
        return;
    }

    const nombreAsesor = (id) => {
        const a = cacheAsesores.find((x) => x.id === id);
        return a ? a.nombre : '—';
    };

    tbody.innerHTML = cerradas
        .sort((a, b) => String(b.fecha_cierre || '').localeCompare(String(a.fecha_cierre || '')))
        .map((p) => `
            <tr>
                <td>${fecha(p.fecha_cierre)}</td>
                <td><strong>${esc(p.codigo || '—')}</strong></td>
                <td>${esc(p.titulo)}<br><small style="color:#888">${esc(p.ubicacion || '')}</small></td>
                <td>${esc(nombreAsesor(p.asesor_id))}</td>
                <td>${estadoBadge(p.estado)}</td>
                <td>${money(p.precio)}</td>
                <td>
                    <div class="cell-actions">
                        <button class="btn-sm btn-edit" data-reabrir="${esc(p.id)}"><i class="fas fa-rotate-left"></i> Reabrir</button>
                        <button class="btn-sm btn-danger" data-hist-del="${esc(p.id)}" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`).join('');

    tbody.querySelectorAll('[data-reabrir]').forEach((b) => b.addEventListener('click', async () => {
        const ok = await confirmar('Reabrir propiedad', '¿Reabrir? La propiedad volverá al catálogo público.', 'Sí, reabrir');
        if (!ok) return;
        const { error } = await window.db.from('properties').update({ estado: 'Disponible', fecha_cierre: null }).eq('id', b.dataset.reabrir);
        if (error) { toast('Error: ' + error.message); return; }
        await loadProperties();
        renderHistorial();
        renderMetricas();
    }));

    tbody.querySelectorAll('[data-hist-del]').forEach((b) => b.addEventListener('click', async () => {
        await borrarPropiedad(b.dataset.histDel);
        renderHistorial();
    }));
}

/** Borra del historial los tratos cerrados hace más de 2 meses. Devuelve true si borró algo. */
async function limpiarHistorial() {
    if (!window.isSupabaseReady || !window.isSupabaseReady()) return false;

    const limite = new Date();
    limite.setMonth(limite.getMonth() - 2);
    const limiteStr = limite.toISOString().slice(0, 10);

    const { data: viejas } = await window.db.from('properties')
        .select('id').neq('estado', 'Disponible').lt('fecha_cierre', limiteStr);
    if (!viejas || !viejas.length) return false;

    const ids = viejas.map((p) => p.id);

    // Recoger sus fotos para borrarlas del almacenamiento
    const { data: imgs } = await window.db.from('property_images')
        .select('path, thumb_path').in('property_id', ids);
    const rutas = [...new Set((imgs || []).flatMap((i) => [i.path, i.thumb_path]).filter(Boolean))];

    const { error } = await window.db.from('properties').delete().in('id', ids);
    if (error) return false;
    if (rutas.length) await window.db.storage.from(window.APP_CONFIG.bucket).remove(rutas);
    return true;
}
