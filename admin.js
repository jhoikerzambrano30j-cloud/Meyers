/* ============================================================
   PANEL DE ADMINISTRACIÓN
   - Propiedades: crear / editar / borrar + subida de fotos (WebP)
   - Usuarios: registrar y exportar (correo + teléfono)
   - Mensajes: leads del formulario de contacto
   ============================================================ */
'use strict';

const TIPOS = ['Casa', 'Apartamento', 'Terreno', 'Local Comercial'];
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
let guardandoPropiedad = false;   // evita guardados dobles
let cacheUsuarios = [];
let cacheLeads = [];
let cacheAsesores = [];
let cachePropiedades = [];
let asesorFoto = null;
let asesorPathsViejos = [];

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
    if (!rows || !rows.length) { alert('No hay datos para exportar.'); return; }
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

    const nameEl = $('#adminName');
    if (nameEl) {
        nameEl.textContent = (currentProfile.full_name || currentUser.email) +
            (currentProfile.role === 'master' ? ' · Master' : ' · Admin');
    }

    $('#logoutBtnAdmin')?.addEventListener('click', () => Auth.signOut());

    initTabs();
    initPropertyForm();
    initUbicaciones();
    initMayusculas();
    initCaracteristicas();
    initAyudas();
    $('#btnNewProperty')?.addEventListener('click', () => openForm(null));
    $('#btnCancelForm')?.addEventListener('click', closeForm);
    $('#btnExportUsers')?.addEventListener('click', () => exportUsuarios());
    $('#btnExportLeads')?.addEventListener('click', () => exportLeads());
    $('#btnNewAsesor')?.addEventListener('click', () => openAsesorForm(null));
    $('#btnCancelAsesor')?.addEventListener('click', closeAsesorForm);
    initAsesorForm();
    $('#asesor')?.addEventListener('change', actualizarCodigoPreview);

    await Promise.all([loadProperties(), loadUsuarios(), loadLeads(), cargarAsesores()]);

    // Limpieza automática del historial: se borran los tratos con más de 2 meses
    if (await limpiarHistorial()) await loadProperties();
});

/* ============================================================
   PESTAÑAS
   ============================================================ */
function initTabs() {
    $$('.admin-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            $$('.admin-tab').forEach((t) => t.classList.remove('active'));
            $$('.admin-panel').forEach((p) => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById('tab-' + tab.dataset.tab);
            if (panel) panel.classList.add('active');
            if (tab.dataset.tab === 'metricas') renderMetricas();
            if (tab.dataset.tab === 'historial') renderHistorial();
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
            <td>${p.imagen ? `<img class="table-thumb" src="${esc(p.imagen)}" alt="">` : '<div class="table-thumb"></div>'}</td>
            <td><strong>${esc(p.codigo || '—')}</strong></td>
            <td>${esc(p.titulo)}<br><small style="color:#888">${esc(p.tipo)} · ${esc(p.ubicacion)}</small></td>
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

/* ---------- Ciudades y Zonas ---------- */
let ciudadesPorNombre = new Map();   // nombre -> id
let zonasCiudadActual = [];          // zonas de la ciudad elegida
let ultimaCiudad = null;

function initUbicaciones() {
    const btnCiudad = $('#btnAddCiudad');
    const btnZona = $('#btnAddZona');
    const inputCiudad = $('#ubicacion');

    if (btnCiudad) btnCiudad.addEventListener('click', agregarCiudad);
    if (btnZona) btnZona.addEventListener('click', agregarZona);
    if (inputCiudad) ['input', 'change'].forEach((evt) => inputCiudad.addEventListener(evt, onCiudadCambia));

    cargarCiudades();
}

async function cargarCiudades() {
    const list = $('#ciudadesList');
    const { data, error } = await window.db.from('locations').select('id, nombre').order('nombre');
    if (error) { alert('No se pudieron cargar las ciudades: ' + error.message); return; }
    ciudadesPorNombre = new Map((data || []).map((c) => [c.nombre, c.id]));
    if (list) list.innerHTML = (data || []).map((c) => `<option value="${esc(c.nombre)}"></option>`).join('');
}

async function onCiudadCambia() {
    const nombre = ($('#ubicacion').value || '').trim().toUpperCase();
    if (nombre === ultimaCiudad) return;
    ultimaCiudad = nombre;
    await cargarZonas(nombre);
}

async function cargarZonas(nombreCiudad) {
    const list = $('#zonasList');
    const inputZona = $('#zona');
    zonasCiudadActual = [];

    const ciudadId = ciudadesPorNombre.get(nombreCiudad);
    if (!ciudadId) {
        if (list) list.innerHTML = '';
        if (inputZona) inputZona.placeholder = nombreCiudad ? 'PRIMERO AGREGA LA CIUDAD (botón +)' : 'ELIGE UNA CIUDAD PRIMERO';
        return;
    }

    const { data } = await window.db.from('zonas').select('nombre').eq('ciudad_id', ciudadId).order('nombre');
    zonasCiudadActual = (data || []).map((z) => z.nombre);
    if (list) list.innerHTML = zonasCiudadActual.map((z) => `<option value="${esc(z)}"></option>`).join('');
    if (inputZona) inputZona.placeholder = zonasCiudadActual.length ? 'ESCRIBE O ELIGE…' : 'ESCRIBE LA PRIMERA ZONA';
}

async function agregarCiudad() {
    const input = $('#ubicacion');
    const nombre = (input.value || '').trim().toUpperCase();
    if (!nombre) { alert('Escribe una ciudad primero.'); return; }
    if (ciudadesPorNombre.has(nombre)) {
        input.value = nombre;
        alert('La ciudad "' + nombre + '" ya existe.');
        return;
    }
    const { error } = await window.db.from('locations').insert({ nombre });
    if (error) { alert('No se pudo agregar la ciudad: ' + error.message); return; }
    await cargarCiudades();
    input.value = nombre;
    ultimaCiudad = null;
    await onCiudadCambia();
    alert('Ciudad "' + nombre + '" agregada. Ahora agrega sus zonas.');
}

async function agregarZona() {
    const inputCiudad = $('#ubicacion');
    const inputZona = $('#zona');
    const ciudad = (inputCiudad.value || '').trim().toUpperCase();
    const zona = (inputZona.value || '').trim().toUpperCase();

    if (!ciudad) { alert('Primero escribe la ciudad.'); return; }
    if (!zona) { alert('Escribe la zona que quieres agregar.'); return; }

    let ciudadId = ciudadesPorNombre.get(ciudad);
    if (!ciudadId) {
        const { data, error } = await window.db.from('locations').insert({ nombre: ciudad }).select('id').single();
        if (error) { alert('No se pudo crear la ciudad: ' + error.message); return; }
        ciudadId = data.id;
        await cargarCiudades();
    }

    if (zonasCiudadActual.includes(zona)) {
        inputZona.value = zona;
        alert('La zona "' + zona + '" ya existe en ' + ciudad + '.');
        return;
    }

    const { error } = await window.db.from('zonas').insert({ ciudad_id: ciudadId, nombre: zona });
    if (error) { alert('No se pudo agregar la zona: ' + error.message); return; }

    ultimaCiudad = null;
    await cargarZonas(ciudad);
    inputZona.value = zona;
    alert('Zona "' + zona + '" agregada a ' + ciudad + '.');
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
    const form = $('#propertyForm');
    form.reset();
    imagenes = [];
    ultimaCiudad = null;
    await cargarZonas('');

    const card = $('#formCard');
    card.style.display = 'block';
    $('#formTitle').textContent = editandoId ? 'Editar propiedad' : 'Nueva propiedad';
    setStatus($('#formStatus'), '', '');
    renderThumbs();
    renderCaracteristicas([]);

    if (editandoId) {
        const p = (lista || []).find((x) => x.id === editandoId) || {};
        // Respaldo: si no vino en la lista, la buscamos
        if (!p.id) return cargarYEditar(editandoId);

        $('#propId').value = p.id || '';
        $('#asesor').value = p.asesor_id || '';
        $('#codigo').value = p.codigo || '';
        $('#titulo').value = p.titulo || '';
        $('#tipo').value = p.tipo || '';
        $('#ubicacion').value = p.ubicacion || '';
        ultimaCiudad = null;
        await cargarZonas((p.ubicacion || '').toUpperCase());
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

    if (noImagen.length) alert('Se ignoraron archivos que no son imágenes.');
    if (grandes.length) alert('Estas imágenes superan ' + MAX_MB + ' MB y se ignoraron: ' + grandes.map((f) => f.name).join(', '));
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
        // Asegurar la ciudad y la zona (siempre en MAYÚSCULAS)
        let ciudadId = ciudadesPorNombre.get(ubicacionVal);
        if (ubicacionVal && !ciudadId) {
            const { data } = await window.db.from('locations').insert({ nombre: ubicacionVal }).select('id').single();
            if (data) { ciudadId = data.id; ciudadesPorNombre.set(ubicacionVal, data.id); }
        }
        if (ciudadId && zonaVal && !zonasCiudadActual.includes(zonaVal)) {
            await window.db.from('zonas').insert({ ciudad_id: ciudadId, nombre: zonaVal });
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
                const continuar = confirm('Ya existe una propiedad con el mismo título, precio y ubicación.\n\n¿Crear otra de todas formas?');
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
    if (error) { alert('Error: ' + error.message); return; }
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
    if (error) { alert('Error: ' + error.message); return; }

    // Borrar las fotos del almacenamiento (evita archivos huérfanos)
    if (rutas.length) await window.db.storage.from(window.APP_CONFIG.bucket).remove(rutas);

    await loadProperties();
}

function closeForm() {
    const card = $('#formCard');
    if (card) card.style.display = 'none';
    imagenes.forEach((i) => i.esNueva && URL.revokeObjectURL(i.url));
    imagenes = [];
    editandoId = null;
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
    const bloqueados = cacheUsuarios.filter((u) => u.bloqueado).length;
    const countEl = $('#usersCount');
    if (countEl) countEl.textContent = `${cacheUsuarios.length} usuarios · ${admins} de 5 administradores · ${bloqueados} bloqueados`;

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
    if (!confirm(bloquear ? '¿Bloquear a este usuario? No podrá iniciar sesión.' : '¿Desbloquear a este usuario?')) return;
    const { error } = await window.db.rpc('admin_set_blocked', { target_id: id, blocked: bloquear });
    if (error) alert('No se pudo actualizar: ' + error.message);
    await loadUsuarios();
}

async function eliminarUsuario(id) {
    if (!confirm('¿Eliminar definitivamente a este usuario? No se puede deshacer.')) return;
    const { error } = await window.db.rpc('admin_delete_user', { target_id: id });
    if (error) alert('No se pudo eliminar: ' + error.message);
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
    return `<select class="role-select" data-role="${esc(u.id)}">
        <option value="user" ${u.role === 'user' ? 'selected' : ''}>Usuario</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option>
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
    const { error } = await window.db.from('profiles').update({ role: sel.value }).eq('id', id);
    if (error) {
        const msg = /5 administradores|máximo/i.test(error.message)
            ? 'Ya hay 5 administradores (el máximo permitido).'
            : error.message;
        alert('No se pudo cambiar el rol: ' + msg);
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

/* ============================================================
   MENSAJES (LEADS)
   ============================================================ */
async function loadLeads() {
    const tbody = $('#leadsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6"><div class="spinner"></div></td></tr>';

    const { data, error } = await window.db
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6">Error: ${esc(error.message)}</td></tr>`;
        return;
    }

    cacheLeads = data || [];
    const countEl = $('#leadsCount');
    if (countEl) countEl.textContent = cacheLeads.length + ' mensajes';

    if (!cacheLeads.length) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><i class="fas fa-envelope-open"></i><p>No hay mensajes todavía.</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = cacheLeads.map((l) => `
        <tr>
            <td>${fecha(l.created_at)}</td>
            <td>${esc(l.nombre)}</td>
            <td>${esc(l.email)}<br><small style="color:#888">${esc(l.telefono || '')}</small></td>
            <td>${esc(l.interes || '—')}</td>
            <td style="max-width:280px">${esc(l.mensaje || '—')}</td>
            <td>
                <div class="cell-actions">
                    <a class="btn-sm btn-edit" href="mailto:${esc(l.email)}"><i class="fas fa-reply"></i></a>
                    <button class="btn-sm btn-edit" data-atendido="${l.id}">${l.atendido ? 'Atendido ✓' : 'Marcar atendido'}</button>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-atendido]').forEach((b) =>
        b.addEventListener('click', async () => {
            const row = cacheLeads.find((x) => x.id === b.dataset.atendido);
            await window.db.from('leads').update({ atendido: !row.atendido }).eq('id', row.id);
            await loadLeads();
        }));
}

function exportLeads() {
    const filas = cacheLeads.map((l) => ({
        Fecha: fecha(l.created_at),
        Nombre: l.nombre || '',
        Correo: l.email || '',
        Telefono: l.telefono || '',
        Interes: l.interes || '',
        Mensaje: l.mensaje || '',
        Atendido: l.atendido ? 'Sí' : 'No'
    }));
    exportCSV(filas, 'mensajes-meyers.csv');
}

/* Filtro de usuarios */
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'usersFilter') loadUsuarios();
});

/* ============================================================
   AYUDAS — botones "?" que explican cada campo
   ============================================================ */
const AYUDAS = [
    ['codigo', 'Se genera solo al guardar, usando la nomenclatura del asesor (ej. BP-0007). No se cambia a mano.'],
    ['asesor', 'Elige el asesor que hizo la captación. Su nomenclatura se usará en el código de la propiedad.'],
    ['asesorNombre', 'Nombre completo del asesor (ej. Belkis Prada).'],
    ['asesorCodigo', 'Nomenclatura de 2 a 4 letras. Se usa en el código de captación (ej. BP-0007).'],
    ['asesorCargo', 'Su rol (ej. Broker, Asesor Inmobiliario).'],
    ['asesorTelefono', 'Teléfono o WhatsApp de contacto.'],
    ['asesorEmail', 'Correo del asesor.'],
    ['asesorInstagram', 'Usuario de Instagram (ej. @meyers.inmobiliaria).'],
    ['asesorBio', 'Breve descripción. Puedes usar ENTER para separar líneas.'],
    ['titulo', 'Nombre corto y claro de la propiedad. Se guarda en MAYÚSCULAS.'],
    ['tipo', 'Categoría: Casa, Apartamento, Terreno o Local Comercial.'],
    ['ubicacion', 'Ciudad. Escribe o elige de la lista. El botón + agrega una ciudad nueva.'],
    ['zona', 'Sector o urbanización DENTRO de la ciudad. Solo aparecen las zonas de la ciudad elegida.'],
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
    const file = Array.from(fileList || []).find((f) => f.type.startsWith('image/'));
    if (!file) return;
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
    const a = cacheAsesores.find((x) => x.id === sel.value);
    if (a) {
        codigo.value = a.codigo + '-' + String((a.contador || 0) + 1).padStart(4, '0');
    } else {
        codigo.value = '';
        codigo.placeholder = 'Selecciona un asesor';
    }
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
            cacheAsesores.filter((a) => a.activo).map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)} (${esc(a.codigo)})</option>`).join('');
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
                            ${a.foto_thumb || a.foto ? `<img class="asesor-mini" src="${esc(a.foto_thumb || a.foto)}" alt="">` : '<div class="asesor-mini"></div>'}
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
    $('#asesorFormCard').style.display = 'block';
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
    if (error) { alert('Error: ' + error.message); return; }
    await cargarAsesores();
}

async function borrarAsesor(id) {
    const ok = await confirmar('Eliminar asesor', 'Sus captaciones se conservan, pero quedarán sin asesor asignado.', 'Sí, eliminar');
    if (!ok) return;
    const a = cacheAsesores.find((x) => x.id === id);
    const rutas = a ? [a.foto_path, a.foto_thumb_path].filter(Boolean) : [];
    const { error } = await window.db.from('asesores').delete().eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    if (rutas.length) await window.db.storage.from(window.APP_CONFIG.bucket).remove(rutas);
    await cargarAsesores();
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
        if (error) { alert('Error: ' + error.message); return; }
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
