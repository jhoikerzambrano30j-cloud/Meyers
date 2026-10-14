/* ============================================================
   PANEL DE ADMINISTRACIÓN
   - Propiedades: crear / editar / borrar + subida de fotos (WebP)
   - Usuarios: registrar y exportar (correo + teléfono)
   - Mensajes: leads del formulario de contacto
   ============================================================ */
'use strict';

const TIPOS = ['Casa', 'Apartamento', 'Terreno', 'Local Comercial'];
const UBICACIONES = ['Zona Norte', 'Zona Sur', 'Centro'];

let currentUser = null;
let currentProfile = null;
let imagenes = [];       // [{ url, path, blob? }]
let editandoId = null;
let cacheUsuarios = [];
let cacheLeads = [];

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
    $('#btnNewProperty')?.addEventListener('click', () => openForm(null));
    $('#btnCancelForm')?.addEventListener('click', closeForm);
    $('#btnExportUsers')?.addEventListener('click', () => exportUsuarios());
    $('#btnExportLeads')?.addEventListener('click', () => exportLeads());

    await Promise.all([loadProperties(), loadUsuarios(), loadLeads()]);
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

function openForm(id, lista) {
    editandoId = id || null;
    const form = $('#propertyForm');
    form.reset();
    imagenes = [];

    const card = $('#formCard');
    card.style.display = 'block';
    $('#formTitle').textContent = editandoId ? 'Editar propiedad' : 'Nueva propiedad';
    setStatus($('#formStatus'), '', '');
    renderThumbs();

    if (editandoId) {
        const p = (lista || []).find((x) => x.id === editandoId) || {};
        // Respaldo: si no vino en la lista, la buscamos
        if (!p.id) return cargarYEditar(editandoId);

        $('#propId').value = p.id || '';
        $('#codigo').value = p.codigo || '';
        $('#titulo').value = p.titulo || '';
        $('#tipo').value = p.tipo || '';
        $('#ubicacion').value = p.ubicacion || '';
        $('#precio').value = p.precio || '';
        $('#habitaciones').value = p.habitaciones || 0;
        $('#banos').value = p.banos || 0;
        $('#area').value = p.area || 0;
        $('#descripcion').value = p.descripcion || '';
        $('#caracteristicas').value = (p.caracteristicas || []).join(', ');
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

    imagenes = (data || []).map((i) => ({ url: i.url, path: i.path }));

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
            <img src="${esc(img.url)}" alt="">
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
    const status = $('#formStatus');
    const btn = $('#propertyForm button[type="submit"]');
    const original = btn.innerHTML;

    const titulo = $('#titulo').value.trim();
    if (!titulo) { setStatus(status, 'El título es obligatorio.', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        // 1) Subir las imágenes nuevas (convertidas a WebP)
        for (const img of imagenes) {
            if (img.esNueva && img.blob) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo fotos...';
                const optim = await window.optimizarImagen(img.blob);
                const subida = await window.subirImagen(optim);
                img.url = subida.url;
                img.path = subida.path;
                img.esNueva = false;
                img.blob = null;
            }
        }

        const portada = imagenes.length ? imagenes[0].url : null;

        const payload = {
            codigo: $('#codigo').value.trim() || null,
            titulo,
            tipo: $('#tipo').value,
            ubicacion: $('#ubicacion').value,
            precio: Number($('#precio').value || 0),
            habitaciones: Number($('#habitaciones').value || 0),
            banos: Number($('#banos').value || 0),
            area: Number($('#area').value || 0),
            descripcion: $('#descripcion').value.trim(),
            caracteristicas: $('#caracteristicas').value
                .split(',').map((s) => s.trim()).filter(Boolean),
            badge: $('#badge').value.trim() || null,
            badge_class: $('#badgeClass').value.trim() || null,
            imagen: portada,
            destacada: $('#destacada').checked
        };

        let propertyId = $('#propId').value || null;

        if (propertyId) {
            const { error } = await window.db.from('properties').update(payload).eq('id', propertyId);
            if (error) throw error;
        } else {
            const { data, error } = await window.db.from('properties').insert(payload).select('id').single();
            if (error) throw error;
            propertyId = data.id;
        }

        // 2) Reguardar la galería
        await window.db.from('property_images').delete().eq('property_id', propertyId);
        if (imagenes.length) {
            const filas = imagenes.map((img, i) => ({
                property_id: propertyId, url: img.url, path: img.path, sort_order: i
            }));
            const { error } = await window.db.from('property_images').insert(filas);
            if (error) throw error;
        }

        setStatus(status, '¡Propiedad guardada correctamente!', 'success');
        await loadProperties();
        setTimeout(closeForm, 900);
    } catch (err) {
        setStatus(status, 'Error: ' + (err.message || err), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

async function borrarPropiedad(id) {
    if (!confirm('¿Seguro que quieres borrar esta propiedad? Esta acción no se puede deshacer.')) return;
    const { error } = await window.db.from('properties').delete().eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
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

/** Botones de acción por usuario (el master no se puede bloquear ni borrar). */
function accionesUsuario(u) {
    const mail = `<a class="btn-sm btn-edit" href="mailto:${esc(u.email || '')}" title="Enviar correo"><i class="fas fa-envelope"></i></a>`;
    if (u.role === 'master') return `<div class="cell-actions">${mail}</div>`;
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

/** Selector de rol (el master no se puede cambiar desde aquí). */
function rolSelect(u) {
    if (u.role === 'master') {
        return '<span class="badge-master"><i class="fas fa-crown"></i> Master</span>';
    }
    return `<select class="role-select" data-role="${esc(u.id)}">
        <option value="user" ${u.role === 'user' ? 'selected' : ''}>Usuario</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option>
    </select>`;
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
