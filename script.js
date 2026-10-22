/* ============================================================
   MEYER'S INMOBILIARIA — Lógica del sitio público
   Lee propiedades y testimonios desde Supabase.
   Si Supabase no está configurado, usa datos de ejemplo.
   ============================================================ */
'use strict';

/* ============================================================
   CONFIGURACIÓN GLOBAL (edita aquí los datos de contacto)
   ============================================================ */
const CONFIG = {
    telefono: '+584141338254',
    whatsapp: '584141338254',
    email: 'inmb.mimeyerhouse@gmail.com',
    whatsappMensaje: 'Hola Meyer\'s, me gustaría recibir información sobre una propiedad.'
};

/* ============================================================
   DATOS
   Las propiedades y testimonios se cargan SIEMPRE desde Supabase
   (ver cargarPropiedades() y cargarTestimonios()).
   Si la carga falla, quedan vacíos y la web muestra un estado
   vacío elegante. NO se guardan datos de ejemplo aquí.
   ============================================================ */
let PROPIEDADES = [];   // Se llena desde la tabla "properties"
let TESTIMONIOS = [];   // Se llena desde la tabla "testimonials"

/* Sin comillas simples dentro: se inserta dentro de un atributo onerror. */
const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22400%22%20height=%22300%22%3E%3Crect%20width=%22400%22%20height=%22300%22%20fill=%22%23eaeaea%22/%3E%3Ctext%20x=%22200%22%20y=%22155%22%20text-anchor=%22middle%22%20fill=%22%239D9D9C%22%20font-family=%22sans-serif%22%20font-size=%2220%22%3ESin%20imagen%3C/text%3E%3C/svg%3E';

/* ============================================================
   UTILIDADES
   ============================================================ */
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}

function slug(text) {
    return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '-');
}

function formatPrice(value) {
    return '$' + Number(value).toLocaleString('en-US');
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   ESTADO
   ============================================================ */
const state = { visibles: [], filtrosActivos: false, mostrarTodas: false };
let favoritos = new Set();
let currentUser = null;
let catalogoPermitido = false;
let currentUserEsAdmin = false;

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', init);

async function init() {
    applyConfig();
    cargarSitio();
    initReveal();
    initScrollEffects();
    initMobileMenu();
    initActiveNav();
    initFiltersDrawer();
    poblarTipos();

    if (window.Auth) {
        currentUser = await window.Auth.getUser();
        if (currentUser) {
            const perfil = await window.Auth.getProfile(currentUser.id);
            if (perfil && perfil.bloqueado) {
                await window.db.auth.signOut();
                currentUser = null;
            } else {
                currentUserEsAdmin = Boolean(perfil && (perfil.role === 'admin' || perfil.role === 'master'));
            }
        }
        window.Auth.renderAuthArea('#authArea');
    }
    catalogoPermitido = Boolean(currentUser);
    if (catalogoPermitido) renderSkeletons();

    await cargarTestimonios();
    await cargarUbicacionesFiltro();
    await cargarEquipo();
    await cargarNosotros();
    await cargarServicios();
    if (catalogoPermitido) {
        await cargarPropiedades();
        await cargarFavoritos();
    }

    poblarZonas();
    poblarCaracteristicas();
    poblarTipos();

    initProperties();
    initTestimonials();
    initSmoothScroll();
    updateFavFloat();

    if (window.Auth) window.Auth.initIdleLogout(10);
}

/** Muestra/oculta el botón flotante de favoritos y su contador. */
function updateFavFloat() {
    const el = $('#favoritesFloat');
    const count = $('#favCount');
    if (!el) return;
    if (!catalogoPermitido) { el.hidden = true; return; }
    el.hidden = false;
    if (count) count.textContent = favoritos.size;
}

/** Aplica los datos de CONFIG a los enlaces del documento. */
function applyConfig() {
    $$('[data-phone]').forEach((el) => { el.href = 'tel:' + CONFIG.telefono; });
    $$('[data-email]').forEach((el) => { el.href = 'mailto:' + CONFIG.email; });
    $$('[data-whatsapp]').forEach((el) => {
        el.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(CONFIG.whatsappMensaje)}`;
    });
    $$('[data-whatsapp-resena]').forEach((el) => {
        el.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent('Hola Meyer\'s, me gustaría dejar mi reseña. ¿Me pueden enviar el enlace?')}`;
    });
    const yearEl = $('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* ============================================================
   CARGA DE DATOS DESDE SUPABASE
   ============================================================ */
async function cargarPropiedades() {
    if (!window.isSupabaseReady || !window.isSupabaseReady()) return;
    try {
        const { data, error } = await window.db
            .from('properties')
            .select('*, asesores(nombre, codigo)')
            .eq('estado', 'Disponible')
            .order('destacada', { ascending: false })
            .order('created_at', { ascending: false });
        if (!error && data && data.length) PROPIEDADES = data.map(mapPropiedad);
    } catch (e) {
        console.warn('[Meyer\'s] No se pudieron cargar las propiedades:', e);
    }
}

async function cargarTestimonios() {    if (!window.isSupabaseReady || !window.isSupabaseReady()) {
        window.warnSupabaseMissing && window.warnSupabaseMissing();
        return;
    }
    try {
        const { data } = await window.db
            .from('testimonials')
            .select('*')
            .eq('estado', 'aprobado')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (data && data.length) {
            TESTIMONIOS = data.map((t) => ({
                nombre: t.nombre,
                rol: t.rol,
                texto: t.texto,
                avatar: t.avatar,
                estrellas: t.estrellas
            }));
        }
    } catch (e) {
        console.warn('[Meyer\'s] No se pudieron cargar los testimonios:', e);
    }
}

async function cargarEquipo() {
    const grid = document.getElementById('equipoGrid');
    if (!grid) return;
    if (!window.isSupabaseReady || !window.isSupabaseReady()) return;
    try {
        const { data } = await window.db.from('asesores').select('*')
            .eq('activo', true).order('orden', { ascending: true }).order('nombre', { ascending: true });
        const lista = data || [];
        if (!lista.length) { grid.closest('section')?.remove(); return; }
        grid.innerHTML = lista.map((a) => `
            <article class="team-card">
                <div class="team-photo">
                    ${(a.foto_thumb || a.foto) ? `<img src="${escapeHtml(a.foto_thumb || a.foto)}" alt="${escapeHtml(a.nombre)}" loading="lazy" decoding="async"
                        onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">` : ''}
                </div>
                <div class="team-body">
                    <h3>${escapeHtml(a.nombre)}</h3>
                    ${a.cargo ? `<p class="team-cargo">${escapeHtml(a.cargo)}</p>` : ''}
                    ${a.bio ? `<p class="team-bio">${escapeHtml(a.bio)}</p>` : ''}
                    <div class="team-contact">
                        ${a.telefono ? `<a href="tel:${escapeHtml(a.telefono)}"><i class="fas fa-phone" aria-hidden="true"></i>${escapeHtml(a.telefono)}</a>` : ''}
                        ${a.email ? `<a href="mailto:${escapeHtml(a.email)}"><i class="fas fa-envelope" aria-hidden="true"></i>${escapeHtml(a.email)}</a>` : ''}
                    </div>
                </div>
            </article>`).join('');
    } catch (e) {
        console.warn('[Meyer\'s] No se pudo cargar el equipo:', e);
    }
}

/** Carga el contenido editable de "Nuestra Historia". */
async function cargarNosotros() {
    if (!window.isSupabaseReady || !window.isSupabaseReady()) return;

    try {
        const { data, error } = await window.db
            .from('about_content')
            .select('*')
            .eq('id', 1)
            .maybeSingle();

        if (error || !data) return;

        const set = (id, valor) => {
            const el = document.getElementById(id);
            if (el && valor != null && String(valor).trim() !== '') el.textContent = valor;
        };

        set('aboutTag', data.tag);
        set('aboutTitle', data.titulo);
        set('aboutBadgeLabel', data.badge_label);
        set('aboutBadgeYear', data.badge_year);

        const cont = document.getElementById('aboutText');
        if (cont && data.texto) {
            const parrafos = String(data.texto).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
            if (parrafos.length) {
                cont.innerHTML = parrafos.map((p) => `<p class="about-text">${escapeHtml(p)}</p>`).join('');
            }
        }

        const img = document.getElementById('aboutImage');
        if (img && data.imagen) {
            img.src = data.imagen;
            if (data.imagen_alt) img.alt = data.imagen_alt;
        }

        set('stat1Numero', data.stat1_numero);
        set('stat1Etiqueta', data.stat1_etiqueta);
        set('stat2Numero', data.stat2_numero);
        set('stat2Etiqueta', data.stat2_etiqueta);
        set('stat3Numero', data.stat3_numero);
        set('stat3Etiqueta', data.stat3_etiqueta);
    } catch (e) {
        // Si la tabla aún no existe, se mantiene el contenido estático de la web
    }
}

/** Carga la configuración general editable (hero, contacto, pie y SEO). */
async function cargarSitio() {
    if (!window.isSupabaseReady || !window.isSupabaseReady()) return;

    try {
        const { data, error } = await window.db
            .from('site_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle();

        if (error || !data) return;

        const set = (id, valor) => {
            const el = document.getElementById(id);
            if (el && valor != null && String(valor).trim() !== '') el.textContent = valor;
        };

        // Hero
        set('heroSubtitulo', data.hero_subtitulo);
        set('heroTitulo', data.hero_titulo);
        set('heroSlogan', data.hero_slogan);
        set('heroTexto', data.hero_texto);
        set('heroCta', data.hero_cta);

        // Contacto (tarjeta y pie de página)
        set('contactoTelefono', data.telefono);
        set('contactoEmail', data.email);
        set('contactoDireccion', data.direccion);
        set('contactoHorario', data.horario);
        set('footerTelefono', data.telefono);
        set('footerEmail', data.email);
        set('footerDireccion', data.direccion);
        set('footerHorario', data.horario);
        set('footerDesc', data.footer_desc);

        // Datos para los enlaces tel:, mailto: y WhatsApp
        if (data.telefono) CONFIG.telefono = data.telefono;
        if (data.whatsapp) CONFIG.whatsapp = String(data.whatsapp).replace(/\D/g, '');
        if (data.email) CONFIG.email = data.email;

        // SEO
        if (data.seo_titulo) document.title = data.seo_titulo;
        const meta = document.getElementById('metaDescription');
        if (meta && data.seo_descripcion) meta.setAttribute('content', data.seo_descripcion);
        const ogTitle = document.getElementById('ogTitle');
        if (ogTitle && data.seo_titulo) ogTitle.setAttribute('content', data.seo_titulo);
        const ogDesc = document.getElementById('ogDescription');
        if (ogDesc && data.seo_descripcion) ogDesc.setAttribute('content', data.seo_descripcion);

        // Redes sociales (solo enlaces http/https)
        [['socialInstagram', data.instagram], ['socialFacebook', data.facebook], ['socialLinkedin', data.linkedin]]
            .forEach(([id, url]) => {
                const el = document.getElementById(id);
                if (!el) return;
                const seguro = /^https?:\/\//i.test(String(url || '').trim()) ? String(url).trim() : '';
                if (seguro) {
                    el.href = seguro;
                    el.hidden = false;
                } else {
                    el.hidden = true;
                }
            });

        const wa = document.getElementById('socialWhatsapp');
        if (wa) wa.href = `https://wa.me/${CONFIG.whatsapp}`;

        // Títulos de las secciones
        set('propTag', data.prop_tag);
        set('propTitulo', data.prop_titulo);
        set('propSubtitulo', data.prop_subtitulo);
        set('servTag', data.serv_tag);
        set('servTitulo', data.serv_titulo);
        set('servSubtitulo', data.serv_subtitulo);
        set('teamTag', data.team_tag);
        set('teamTitulo', data.team_titulo);
        set('teamSubtitulo', data.team_subtitulo);
        set('testTag', data.test_tag);
        set('testTitulo', data.test_titulo);
        set('testSubtitulo', data.test_subtitulo);
        set('ctaTag', data.cta_tag);
        set('ctaTitulo', data.cta_titulo);
        set('ctaTexto', data.cta_texto);

        // Imagen de fondo del hero
        const hero = document.querySelector('.hero');
        if (hero && data.hero_imagen) {
            hero.style.backgroundImage = `url("${data.hero_imagen}")`;
        }

        // Refresca todos los enlaces con los datos nuevos
        applyConfig();
    } catch (e) {
        // Si la tabla aún no existe se mantienen los datos por defecto
    }
}

/** Carga las tarjetas de servicios editables. */
async function cargarServicios() {
    const grid = document.getElementById('servicesGrid');
    if (!grid || !window.isSupabaseReady || !window.isSupabaseReady()) return;

    try {
        const { data, error } = await window.db
            .from('services')
            .select('*')
            .eq('activo', true)
            .order('orden', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) return;
        if (!data || !data.length) {
            grid.innerHTML = '';
            return;
        }

        const permitidos = new Set([
            'fa-house', 'fa-building', 'fa-key', 'fa-hand-holding-usd', 'fa-chart-line',
            'fa-file-signature', 'fa-handshake', 'fa-map-location-dot', 'fa-camera',
            'fa-ruler-combined', 'fa-user-tie', 'fa-scale-balanced', 'fa-coins',
            'fa-city', 'fa-store', 'fa-tree', 'fa-water', 'fa-car',
            'fa-shield-halved', 'fa-star'
        ]);

        grid.innerHTML = data.map((s) => {
            const icono = permitidos.has(s.icono) ? s.icono : 'fa-house';
            return `
                <div class="service-card reveal">
                    <div class="service-icon"><i class="fas ${icono}" aria-hidden="true"></i></div>
                    <h3>${escapeHtml(s.titulo)}</h3>
                    <p>${escapeHtml(s.descripcion)}</p>
                </div>`;
        }).join('');

        initReveal();
    } catch (e) {
        // Si la tabla no existe, se mantienen las tarjetas estáticas
    }
}

async function cargarUbicacionesFiltro() {
    const sel = document.getElementById('ubicacion');
    if (!sel || !window.isSupabaseReady || !window.isSupabaseReady()) return;
    try {
        const { data } = await window.db.from('locations').select('nombre').order('nombre', { ascending: true });
        if (!data || !data.length) return;
        data.forEach((l) => {
            const opt = document.createElement('option');
            opt.value = slug(l.nombre);
            opt.textContent = l.nombre;
            sel.appendChild(opt);
        });
    } catch (e) {
        console.warn('[Meyer\'s] No se pudieron cargar las ubicaciones:', e);
    }
}

function mapPropiedad(p) {
    return {
        id: p.id,
        codigo: p.codigo,
        titulo: p.titulo,
        tipo: p.tipo,
        operacion: p.operacion || 'Venta',
        ubicacion: p.ubicacion,
        zona: p.zona,
        asesor: p.asesores ? p.asesores.nombre : null,
        estado: p.estado || 'Disponible',
        precio: p.precio,
        habitaciones: p.habitaciones,
        banos: p.banos,
        area: p.area,
        imagen: p.imagen,
        imagenThumb: p.imagen_thumb || p.imagen,
        badge: p.badge,
        badgeClass: p.badge_class || '',
        destacada: p.destacada,
        descripcion: p.descripcion,
        caracteristicas: p.caracteristicas || []
    };
}

async function cargarFavoritos() {
    if (!window.Auth) return;
    try {
        const lista = await window.Auth.getFavorites();
        favoritos = new Set(lista);
    } catch (e) {
        favoritos = new Set();
    }
}

/* ============================================================
   PROPIEDADES: RENDER, FILTROS Y MODAL
   ============================================================ */
function initProperties() {
    const grid = $('#propertiesGrid');
    const form = $('#searchForm');
    const viewAllBtn = $('#viewAllBtn');
    const clearBtn = $('#clearFilters');
    if (!grid) return;

    grid.addEventListener('click', async (event) => {
        const favBtn = event.target.closest('[data-fav]');
        if (favBtn) {
            event.stopPropagation();
            await onToggleFavorito(favBtn);
            return;
        }
        if (event.target.closest('[data-action="clear-filters"]')) { resetFilters(); return; }
        const card = event.target.closest('.property-card');
        if (card) openModal(card.dataset.id);
    });

    grid.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.target.closest('[data-fav]')) return;
        const card = event.target.closest('.property-card');
        if (card) { event.preventDefault(); openModal(card.dataset.id); }
    });

    if (form) form.addEventListener('submit', (event) => { event.preventDefault(); applyFilters(); });
    if (viewAllBtn) viewAllBtn.addEventListener('click', showAll);
    if (clearBtn) clearBtn.addEventListener('click', resetFilters);
    $('#ubicacion')?.addEventListener('change', poblarZonas);

    initModal();

    if (!catalogoPermitido) {
        showCatalogGate();
        return;
    }
    renderFeatured();
}

/** Oculta el catálogo y muestra el mensaje para invitados. */
function showCatalogGate() {
    const gate = $('#catalogGate');
    const grid = $('#propertiesGrid');
    const results = $('#resultsBar');
    const viewAll = $('#viewAllWrapper');
    if (results) results.hidden = true;
    if (viewAll) viewAll.hidden = true;
    if (grid) grid.hidden = true;
    if (gate) gate.hidden = false;
}

/** Tarjetas fantasma mientras cargan las propiedades. */
function renderSkeletons(cantidad = 6) {
    const grid = $('#propertiesGrid');
    if (!grid) return;
    grid.innerHTML = Array.from({ length: cantidad }, () => `
        <div class="skeleton-card" aria-hidden="true">
            <div class="skeleton skeleton-img"></div>
            <div class="skeleton-body">
                <div class="skeleton skeleton-line w-30"></div>
                <div class="skeleton skeleton-line tall w-70"></div>
                <div class="skeleton skeleton-line w-50"></div>
                <div class="skeleton skeleton-line w-90"></div>
            </div>
        </div>`).join('');
}

async function onToggleFavorito(btn) {
    try {
        const marcado = await window.Auth.toggleFavorite(btn.dataset.fav);
        if (marcado) favoritos.add(btn.dataset.fav);
        else favoritos.delete(btn.dataset.fav);
        btn.classList.toggle('active', marcado);
        updateFavFloat();
    } catch (err) {
        if (err && err.needLogin) {
            window.location.href = 'login.html';
        } else {
            alert('No se pudo guardar el favorito: ' + (err.message || err));
        }
    }
}

function cardTemplate(prop, i = 0) {
    const features = [
        prop.habitaciones > 0 ? `<span class="property-feature"><i class="fas fa-bed" aria-hidden="true"></i> ${escapeHtml(prop.habitaciones)} Hab.</span>` : '',
        prop.banos > 0 ? `<span class="property-feature"><i class="fas fa-bath" aria-hidden="true"></i> ${escapeHtml(prop.banos)} Baños</span>` : '',
        `<span class="property-feature"><i class="fas fa-ruler-combined" aria-hidden="true"></i> ${escapeHtml(prop.area)} m²</span>`
    ].join('');

    const badge = prop.badge
        ? `<span class="property-badge ${escapeHtml(prop.badgeClass)}">${escapeHtml(prop.badge)}</span>` : '';

    const activo = favoritos.has(prop.id) ? 'active' : '';

    return `
        <article class="property-card" data-id="${escapeHtml(prop.id)}" role="button" tabindex="0"
                 style="animation-delay: ${Math.min(i, 8) * 70}ms"
                 aria-label="Ver detalle de ${escapeHtml(prop.titulo)}">
            <div class="property-image">
                ${badge}
                <button type="button" class="fav-btn ${activo}" data-fav="${escapeHtml(prop.id)}" aria-label="Guardar en favoritos">
                    <i class="fas fa-heart" aria-hidden="true"></i>
                </button>
                <img src="${escapeHtml(prop.imagenThumb || prop.imagen || PLACEHOLDER_IMG)}" alt="${escapeHtml(prop.titulo)}" loading="lazy" decoding="async"
                     onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
                <div class="property-price">${formatPrice(prop.precio)}</div>
            </div>
            <div class="property-content">
                <p class="property-type">${escapeHtml(prop.operacion || 'Venta')} · ${escapeHtml(prop.tipo)}</p>
                <h3 class="property-title">${escapeHtml(prop.titulo)}</h3>
                <p class="property-location"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${escapeHtml(prop.ubicacion)}${prop.zona ? ' · ' + escapeHtml(prop.zona) : ''}</p>
                <div class="property-features">${features}</div>
                <span class="property-more">Ver detalle <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
            </div>
        </article>
    `;
}

function renderProperties(lista) {
    const grid = $('#propertiesGrid');
    if (!grid) return;
    if (!lista.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-house-circle-xmark" aria-hidden="true"></i>
                <h3>No encontramos propiedades</h3>
                <p>Prueba ajustando los filtros o explora todas las propiedades disponibles.</p>
                <button type="button" class="btn btn-outline" data-action="clear-filters">Ver todas las propiedades</button>
            </div>`;
        return;
    }
    grid.innerHTML = ordenarPropiedades(lista).map((prop, i) => cardTemplate(prop, i)).join('');
}

function renderFeatured() {
    state.visibles = PROPIEDADES.filter((p) => p.destacada);
    if (!state.visibles.length) state.visibles = [...PROPIEDADES];
    state.filtrosActivos = false;
    state.mostrarTodas = false;
    renderProperties(state.visibles);
    updateResultsBar();
}

function applyFilters() {
    if (!catalogoPermitido) {
        showCatalogGate();
        $('#propiedades')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
        return;
    }
    const operacion = $('#operacion')?.value || '';
    const tipo = $('#tipo')?.value || '';
    const ubicacion = $('#ubicacion')?.value || '';
    const precioOption = $('#precio')?.selectedOptions?.[0];
    const min = precioOption?.dataset.min ?? '';
    const max = precioOption?.dataset.max ?? '';
    const zona = $('#zona')?.value || '';
    const habitaciones = Number($('#habitaciones')?.value || 0);
    const banos = Number($('#banos')?.value || 0);
    const areaOption = $('#area')?.selectedOptions?.[0];
    const areaMin = areaOption?.dataset.min ?? '';
    const areaMax = areaOption?.dataset.max ?? '';
    const caracteristica = ($('#caracteristica')?.value || '').toLowerCase();
    const soloDestacadas = Boolean($('#soloDestacadas')?.checked);

    state.visibles = PROPIEDADES.filter((prop) => {
        if (operacion && slug(prop.operacion || 'Venta') !== operacion) return false;
        if (tipo && slug(prop.tipo) !== tipo) return false;
        if (ubicacion && slug(prop.ubicacion) !== ubicacion) return false;
        if (zona && prop.zona !== zona) return false;
        if (min !== '' && Number(prop.precio) < Number(min)) return false;
        if (max !== '' && Number(prop.precio) > Number(max)) return false;
        if (habitaciones && Number(prop.habitaciones) < habitaciones) return false;
        if (banos && Number(prop.banos) < banos) return false;
        if (areaMin !== '' && Number(prop.area) < Number(areaMin)) return false;
        if (areaMax !== '' && Number(prop.area) > Number(areaMax)) return false;
        if (caracteristica && !(prop.caracteristicas || []).some((c) => String(c).toLowerCase().includes(caracteristica))) return false;
        if (soloDestacadas && !prop.destacada) return false;
        return true;
    });

    state.filtrosActivos = Boolean(
        operacion || tipo || ubicacion || min !== '' || max !== '' || zona ||
        habitaciones || banos || areaMin !== '' || areaMax !== '' ||
        caracteristica || soloDestacadas
    );
    state.mostrarTodas = false;

    renderProperties(state.visibles);
    updateResultsBar();
    actualizarBadgeFiltros();
    $('#propiedades')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
}

function showAll() {
    state.visibles = [...PROPIEDADES];
    state.filtrosActivos = false;
    state.mostrarTodas = true;
    renderProperties(state.visibles);
    updateResultsBar();
}

function resetFilters() {
    $('#searchForm')?.reset();
    ['zona', 'habitaciones', 'banos', 'area', 'caracteristica', 'orden'].forEach((id) => {
        const el = $('#' + id);
        if (el) el.value = '';
    });
    const dest = $('#soloDestacadas');
    if (dest) dest.checked = false;
    poblarZonas();
    actualizarBadgeFiltros();
    showAll();
}

/** Llena el filtro de tipos con la lista predeterminada (+ tipos antiguos). */
function poblarTipos() {
    const sel = $('#tipo');
    if (!sel) return;
    const actual = sel.value;
    const base = (window.APP_CONFIG && window.APP_CONFIG.tiposPropiedad) || [];

    // Une la lista oficial con cualquier tipo que ya exista en el catálogo
    const tipos = [...base];
    PROPIEDADES.map((p) => p.tipo).filter(Boolean).forEach((t) => {
        if (!tipos.includes(t)) tipos.push(t);
    });

    if (!tipos.length) return; // deja las opciones del HTML como respaldo

    sel.innerHTML = '<option value="">Todos</option>' +
        tipos.map((t) => `<option value="${slug(t)}">${escapeHtml(t)}</option>`).join('');

    if (actual) sel.value = actual;
}

/** Limpia y repuebla las zonas según la ciudad elegida. */
function poblarZonas() {
    const sel = $('#zona');
    if (!sel) return;
    const ciudad = $('#ubicacion')?.value || '';
    const actual = sel.value;

    const zonas = [...new Set(PROPIEDADES
        .filter((p) => !ciudad || slug(p.ubicacion) === ciudad)
        .map((p) => p.zona)
        .filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'es'));

    sel.innerHTML = '<option value="">Cualquiera</option>' +
        zonas.map((z) => `<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`).join('');

    if (zonas.includes(actual)) sel.value = actual;
}

/** Llena el filtro de características con las que existen en el catálogo. */
function poblarCaracteristicas() {
    const sel = $('#caracteristica');
    if (!sel) return;
    const actual = sel.value;

    const valores = [...new Set(PROPIEDADES
        .flatMap((p) => p.caracteristicas || [])
        .map((c) => String(c).trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'));

    sel.innerHTML = '<option value="">Cualquiera</option>' +
        valores.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

    if (valores.includes(actual)) sel.value = actual;
}

/** Cuenta cuántos filtros avanzados están activos. */
function contarFiltrosExtra() {
    let n = 0;
    ['zona', 'habitaciones', 'banos', 'area', 'caracteristica'].forEach((id) => {
        if ($('#' + id)?.value) n++;
    });
    if ($('#soloDestacadas')?.checked) n++;
    return n;
}

/** Actualiza el numerito del botón "Más filtros". */
function actualizarBadgeFiltros() {
    const badge = $('#filtersBadge');
    if (!badge) return;
    const n = contarFiltrosExtra();
    badge.textContent = n;
    badge.hidden = n === 0;
}

/** Abre/cierra el panel de filtros avanzados. */
function initFiltersDrawer() {
    const overlay = $('#filtersOverlay');
    const btn = $('#btnMoreFilters');
    if (!overlay || !btn) return;

    const abrir = () => {
        overlay.hidden = false;
        void overlay.offsetWidth; // permite que la animación se reproduzca
        overlay.classList.add('active');
        document.body.classList.add('no-scroll');
        $('#filtersClose')?.focus();
    };

    const cerrar = () => {
        overlay.classList.remove('active');
        document.body.classList.remove('no-scroll');
        setTimeout(() => { overlay.hidden = true; }, 250);
    };

    btn.addEventListener('click', abrir);
    $('#filtersClose')?.addEventListener('click', cerrar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.hidden) cerrar();
    });

    $('#filtersApply')?.addEventListener('click', () => { applyFilters(); cerrar(); });

    $('#filtersClear')?.addEventListener('click', () => {
        ['zona', 'habitaciones', 'banos', 'area', 'caracteristica', 'orden'].forEach((id) => {
            const el = $('#' + id);
            if (el) el.value = '';
        });
        const dest = $('#soloDestacadas');
        if (dest) dest.checked = false;
        actualizarBadgeFiltros();
    });

    ['zona', 'habitaciones', 'banos', 'area', 'caracteristica', 'soloDestacadas'].forEach((id) => {
        const el = $('#' + id);
        if (el) el.addEventListener('change', actualizarBadgeFiltros);
    });

    actualizarBadgeFiltros();
}

/** Aplica el orden elegido sin modificar la lista original. */
function ordenarPropiedades(lista) {
    const orden = $('#orden')?.value || '';
    if (!orden) return lista;
    const copia = [...lista];
    if (orden === 'precio-asc') copia.sort((a, b) => Number(a.precio) - Number(b.precio));
    else if (orden === 'precio-desc') copia.sort((a, b) => Number(b.precio) - Number(a.precio));
    else if (orden === 'area-desc') copia.sort((a, b) => Number(b.area) - Number(a.area));
    return copia;
}

function updateResultsBar() {
    const countEl = $('#resultsCount');
    const clearBtn = $('#clearFilters');
    const viewAllWrapper = $('#viewAllWrapper');
    const total = state.visibles.length;

    if (countEl) {
        if (state.filtrosActivos) {
            countEl.textContent = total
                ? `${total} propiedad${total === 1 ? '' : 'es'} encontrada${total === 1 ? '' : 's'}`
                : 'Sin resultados para tu búsqueda';
        } else if (state.mostrarTodas) {
            countEl.textContent = `Mostrando las ${total} propiedades disponibles`;
        } else {
            countEl.textContent = `Propiedades destacadas (${total} de ${PROPIEDADES.length})`;
        }
    }
    if (clearBtn) clearBtn.hidden = !state.filtrosActivos;
    if (viewAllWrapper) viewAllWrapper.hidden = state.filtrosActivos || state.mostrarTodas;
}

/* ---------- Modal ---------- */
let lastFocusedElement = null;
let closeTimeoutId = null;

function initModal() {
    const overlay = $('#propertyModal');
    const closeBtn = $('#modalClose');
    if (!overlay) return;

    closeBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(); });
    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeModal();
        if (event.key === 'Tab') trapFocus(event, overlay);
    });
}

function openModal(id) {
    const overlay = $('#propertyModal');
    const body = $('#modalBody');
    const prop = PROPIEDADES.find((item) => String(item.id) === String(id));
    if (!overlay || !body || !prop) return;

    lastFocusedElement = document.activeElement;
    body.innerHTML = modalTemplate(prop);
    cargarGaleria(prop);
    prepararDescripcion();

    const btnAcordado = document.getElementById('btnAcordado');
    if (btnAcordado) btnAcordado.addEventListener('click', () => marcarAcordado(prop.id));
    if (closeTimeoutId) { clearTimeout(closeTimeoutId); closeTimeoutId = null; }

    overlay.hidden = false;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => overlay.classList.add('active'));
    $('#modalClose')?.focus();
}

function closeModal() {
    const overlay = $('#propertyModal');
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('active');
    document.body.classList.remove('no-scroll');
    closeTimeoutId = setTimeout(() => {
        overlay.hidden = true;
        $('#modalBody').innerHTML = '';
        closeTimeoutId = null;
        if (lastFocusedElement) lastFocusedElement.focus();
    }, prefersReducedMotion ? 0 : 300);
}

function trapFocus(event, container) {
    const focusables = $$('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])', container)
        .filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

/** (Solo admin) Marca la propiedad como Acordada desde el detalle público. */
async function marcarAcordado(id) {
    if (!window.isSupabaseReady || !window.isSupabaseReady()) return;
    if (!window.confirm('¿Marcar esta propiedad como ACORDADA? Saldrá del catálogo público.')) return;
    const hoy = new Date().toISOString().slice(0, 10);
    const { error } = await window.db.from('properties').update({ estado: 'Acordado', fecha_cierre: hoy }).eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    closeModal();
    await cargarPropiedades();
    renderFeatured();
}

function modalTemplate(prop) {
    const waText = encodeURIComponent(
        `Hola Meyer's, me interesa la propiedad "${prop.titulo}" (${prop.codigo || ''}). ¿Podrían darme más información?`
    );
    const features = [
        prop.habitaciones > 0 ? `<span><i class="fas fa-bed" aria-hidden="true"></i>${escapeHtml(prop.habitaciones)} Habitaciones</span>` : '',
        prop.banos > 0 ? `<span><i class="fas fa-bath" aria-hidden="true"></i>${escapeHtml(prop.banos)} Baños</span>` : '',
        `<span><i class="fas fa-ruler-combined" aria-hidden="true"></i>${escapeHtml(prop.area)} m²</span>`,
        prop.codigo ? `<span><i class="fas fa-tag" aria-hidden="true"></i>${escapeHtml(prop.codigo)}</span>` : ''
    ].join('');
    const extras = (prop.caracteristicas || []).map((c) =>
        `<span><i class="fas fa-check" aria-hidden="true"></i>${escapeHtml(c)}</span>`).join('');

    return `
        <div class="modal-hero">
            <img class="modal-hero-bg" id="modalBg" src="${escapeHtml(prop.imagen || PLACEHOLDER_IMG)}" alt="" aria-hidden="true">
            <img id="modalMainImg" src="${escapeHtml(prop.imagen || PLACEHOLDER_IMG)}" alt="${escapeHtml(prop.titulo)}" decoding="async"
                 onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
            <div class="property-price">${formatPrice(prop.precio)}</div>
        </div>
        <div class="modal-gallery" id="modalGallery"></div>
        <div class="modal-content">
            <p class="property-type">${escapeHtml(prop.operacion || 'Venta')} · ${escapeHtml(prop.tipo)}</p>
            <h2 id="modalTitle">${escapeHtml(prop.titulo)}</h2>
            <div class="modal-meta">
                <span><i class="fas fa-map-marker-alt" aria-hidden="true"></i>${escapeHtml(prop.ubicacion)}${prop.zona ? ' · ' + escapeHtml(prop.zona) : ''}</span>
                ${prop.asesor ? `<span><i class="fas fa-user-tie" aria-hidden="true"></i>Asesor: ${escapeHtml(prop.asesor)}</span>` : ''}
            </div>
            <div class="modal-description" id="modalDesc">${descripcionHtml(prop.descripcion)}</div>
            <button type="button" class="desc-toggle" id="descToggle" style="display:none">Ver más</button>
            <div class="modal-features">${features}</div>
            ${extras ? '<h3 style="margin:15px 0">Características</h3><div class="modal-features">' + extras + '</div>' : ''}
            <div class="modal-cta">
                ${currentUserEsAdmin
                    ? `<button type="button" class="btn btn-primary" id="btnAcordado">
                           <i class="fas fa-handshake" aria-hidden="true"></i> Marcar como Acordado
                       </button>`
                    : `<a href="https://wa.me/${CONFIG.whatsapp}?text=${waText}" class="btn btn-primary" target="_blank" rel="noopener noreferrer">
                           <i class="fab fa-whatsapp" aria-hidden="true"></i> Consultar por WhatsApp
                       </a>
                       <a href="#contacto" class="btn btn-outline" data-close-modal>Agendar visita</a>`}
            </div>
        </div>`;
}

/** Convierte una descripción larga en algo legible: párrafos + lista con ✓. */
function descripcionHtml(texto) {
    let t = String(texto || '').trim();
    if (!t) return '';
    // Quitar hashtags de redes sociales (no aportan en la web)
    t = t.replace(/#[^\s#]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    // Separar en ítems los textos que vienen con " - " o ":-"
    t = t.replace(/(\s+|:)-{1,2}\s*/g, '\n- ');
    const lineas = t.split('\n').map((l) => l.trim()).filter(Boolean);

    let html = '';
    let enLista = false;
    lineas.forEach((l) => {
        if (l.startsWith('-')) {
            if (!enLista) { html += '<ul>'; enLista = true; }
            html += '<li>' + escapeHtml(l.replace(/^-\s*/, '')) + '</li>';
        } else {
            if (enLista) { html += '</ul>'; enLista = false; }
            html += '<p>' + escapeHtml(l) + '</p>';
        }
    });
    if (enLista) html += '</ul>';
    return html;
}

/** Muestra "Ver más" solo si la descripción es larga. */
function prepararDescripcion() {
    const desc = document.getElementById('modalDesc');
    const btn = document.getElementById('descToggle');
    if (!desc || !btn || !desc.textContent.trim()) { if (btn) btn.remove(); return; }
    if (desc.scrollHeight <= 320) { btn.remove(); return; }
    desc.classList.add('collapsed');
    btn.style.display = 'inline-block';
    btn.addEventListener('click', () => {
        const colapsada = desc.classList.toggle('collapsed');
        btn.textContent = colapsada ? 'Ver más' : 'Ver menos';
    });
}

/** Carga las fotos de la galería dentro del modal de detalle. */
async function cargarGaleria(prop) {
    const cont = document.getElementById('modalGallery');
    if (!cont) return;
    if (!window.isSupabaseReady || !window.isSupabaseReady()) { cont.remove(); return; }
    try {
        const { data } = await window.db.from('property_images')
            .select('url, thumb').eq('property_id', prop.id).order('sort_order', { ascending: true });

        // Cada foto: grande (detalle) + mini (galería)
        const fotos = (data || []).map((i) => ({ grande: i.url, mini: i.thumb || i.url }));
        if (!fotos.length && prop.imagen) fotos.push({ grande: prop.imagen, mini: prop.imagenThumb || prop.imagen });

        // Quitar duplicados (por la foto grande)
        const vistos = new Set();
        const unicas = [];
        fotos.forEach((f) => { if (f.grande && !vistos.has(f.grande)) { vistos.add(f.grande); unicas.push(f); } });
        if (unicas.length <= 1) { cont.remove(); return; }

        cont.innerHTML = unicas.map((f, i) => `
            <button type="button" class="gallery-thumb${i === 0 ? ' active' : ''}" data-img="${escapeHtml(f.grande)}" aria-label="Ver foto ${i + 1}">
                <img src="${escapeHtml(f.mini)}" alt="" loading="lazy" decoding="async"
                     onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
            </button>`).join('');

        cont.querySelectorAll('[data-img]').forEach((b) => b.addEventListener('click', () => {
            const main = document.getElementById('modalMainImg');
            const bg = document.getElementById('modalBg');
            if (main) main.src = b.dataset.img;
            if (bg) bg.src = b.dataset.img;
            cont.querySelectorAll('.gallery-thumb').forEach((x) => x.classList.remove('active'));
            b.classList.add('active');
        }));
    } catch (e) {
        cont.remove();
    }
}

/* ============================================================
   TESTIMONIOS
   ============================================================ */
function initTestimonials() {
    const slider = $('#testimonialsSlider');
    const dotsContainer = $('#sliderDots');
    if (!slider || !dotsContainer) return;

    if (!TESTIMONIOS.length) {
        slider.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comment-dots" aria-hidden="true"></i>
                <h3>Pronto compartiremos historias</h3>
                <p>Estamos preparando los testimonios de nuestros clientes.</p>
            </div>`;
        dotsContainer.innerHTML = '';
        return;
    }

    slider.innerHTML = TESTIMONIOS.map((t) => {
        const n = Math.max(1, Math.min(5, Number(t.estrellas) || 5));
        const estrellas = '<span class="star filled">★</span>'.repeat(n) +
            '<span class="star">★</span>'.repeat(5 - n);
        const inicial = String(t.nombre || '?').trim().charAt(0).toUpperCase();
        const avatar = t.avatar
            ? `<img src="${escapeHtml(t.avatar)}" alt="${escapeHtml(t.nombre)}" class="testimonial-avatar" loading="lazy" decoding="async"
                     onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">`
            : `<span class="testimonial-avatar testimonial-avatar-initial" aria-hidden="true">${escapeHtml(inicial)}</span>`;

        return `
        <div class="testimonial-card">
            <div class="testimonial-stars" aria-label="${n} de 5 estrellas">${estrellas}</div>
            <p class="testimonial-text">"${escapeHtml(t.texto)}"</p>
            <div class="testimonial-author">
                ${avatar}
                <div>
                    <p class="testimonial-name">${escapeHtml(t.nombre)}</p>
                    <p class="testimonial-role">${escapeHtml(t.rol || '')}</p>
                </div>
            </div>
        </div>`;
    }).join('');

    dotsContainer.innerHTML = TESTIMONIOS.map((_, i) =>
        `<button type="button" class="dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Ir al testimonio ${i + 1}"></button>`).join('');

    const dots = $$('.dot', dotsContainer);
    let currentIndex = 0;
    let autoplayTimer = null;

    const goTo = (index, smooth = true) => {
        const card = slider.children[index];
        if (!card) return;
        slider.scrollTo({ left: card.offsetLeft - slider.offsetLeft, behavior: smooth && !prefersReducedMotion ? 'smooth' : 'auto' });
    };
    const setActiveDot = (index) => { currentIndex = index; dots.forEach((d, i) => d.classList.toggle('active', i === index)); };

    dots.forEach((dot) => dot.addEventListener('click', () => {
        const i = Number(dot.dataset.index); setActiveDot(i); goTo(i); restartAutoplay();
    }));

    let scrollFrame = null;
    slider.addEventListener('scroll', () => {
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(() => {
            scrollFrame = null;
            let closest = 0, min = Infinity;
            Array.from(slider.children).forEach((card, i) => {
                const d = Math.abs(card.offsetLeft - slider.offsetLeft - slider.scrollLeft);
                if (d < min) { min = d; closest = i; }
            });
            setActiveDot(closest);
        });
    });

    const startAutoplay = () => {
        if (prefersReducedMotion) return;
        stopAutoplay();
        autoplayTimer = setInterval(() => { const n = (currentIndex + 1) % TESTIMONIOS.length; setActiveDot(n); goTo(n); }, 5000);
    };
    const stopAutoplay = () => { if (autoplayTimer) clearInterval(autoplayTimer); autoplayTimer = null; };
    const restartAutoplay = () => { stopAutoplay(); startAutoplay(); };

    slider.addEventListener('mouseenter', stopAutoplay);
    slider.addEventListener('mouseleave', startAutoplay);
    slider.addEventListener('focusin', stopAutoplay);
    slider.addEventListener('focusout', startAutoplay);
    document.addEventListener('visibilitychange', () => { document.hidden ? stopAutoplay() : startAutoplay(); });

    startAutoplay();
}

/* ============================================================
   NAVBAR / NAVEGACIÓN
   ============================================================ */
function initScrollEffects() {
    const navbar = $('#navbar');
    const button = $('#backToTop');
    if (button) button.hidden = false;

    let ticking = false;
    const update = () => {
        const y = window.scrollY;
        if (navbar) navbar.classList.toggle('scrolled', y > 50);
        if (button) button.classList.toggle('visible', y > 500);
        ticking = false;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (button) {
        button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' }));
    }
}

function initActiveNav() {
    const links = $$('.nav-link');
    if (!links.length || !('IntersectionObserver' in window)) return;
    const map = new Map();
    links.forEach((link) => {
        const id = link.getAttribute('href')?.slice(1);
        const section = id ? document.getElementById(id) : null;
        if (section) map.set(section, link);
    });
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            links.forEach((l) => l.classList.remove('active'));
            map.get(entry.target)?.classList.add('active');
        });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    map.forEach((_, section) => observer.observe(section));
}

function initMobileMenu() {
    const hamburger = $('#hamburger');
    const navMenu = $('#navMenu');
    const overlay = $('#navOverlay');
    if (!hamburger || !navMenu) return;

    const setMenu = (open) => {
        navMenu.classList.toggle('active', open);
        hamburger.classList.toggle('active', open);
        hamburger.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('no-scroll', open);
        if (overlay) overlay.hidden = !open;
        requestAnimationFrame(() => overlay?.classList.toggle('active', open));
    };
    hamburger.addEventListener('click', () => setMenu(!navMenu.classList.contains('active')));
    overlay?.addEventListener('click', () => setMenu(false));
    navMenu.querySelectorAll('.nav-link').forEach((l) => l.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && navMenu.classList.contains('active')) setMenu(false); });
    window.matchMedia('(min-width: 993px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
}

/* ============================================================
   SCROLL SUAVE / REVEAL / VOLVER ARRIBA
   ============================================================ */
function initSmoothScroll() {
    document.addEventListener('click', (event) => {
        const anchor = event.target.closest('a[href^="#"]');
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!href || href === '#') { event.preventDefault(); return; }
        const target = document.getElementById(href.slice(1));
        if (!target) return;
        event.preventDefault();
        if (anchor.hasAttribute('data-close-modal')) closeModal();
        target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', href);
    });
}

function initReveal() {
    const elements = $$('.reveal');
    if (!elements.length) return;
    if (!('IntersectionObserver' in window) || prefersReducedMotion) {
        elements.forEach((el) => el.classList.add('visible'));
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
    elements.forEach((el) => observer.observe(el));
}

/* (El scroll de la barra y "volver arriba" se manejan en initScrollEffects) */
