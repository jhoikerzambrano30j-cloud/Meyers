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
    telefonoDisplay: '0414-1338254',
    telefono: '+584141338254',
    whatsapp: '584141338254',
    email: 'inmb.mimeyerhouse@gmail.com',
    whatsappMensaje: 'Hola Meyer\'s, me gustaría recibir información sobre una propiedad.'
};

/* ============================================================
   DATOS DE EJEMPLO (respaldo si Supabase no está configurado)
   ============================================================ */
let PROPIEDADES = [
    {
        id: 'demo-1', codigo: 'MY-001', titulo: 'Villa Moderna con Vista al Mar',
        tipo: 'Casa', ubicacion: 'Zona Norte', precio: 250000, habitaciones: 4, banos: 3, area: 350,
        imagen: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80',
        badge: 'Destacada', badgeClass: 'new', destacada: true,
        descripcion: 'Espectacular villa de líneas contemporáneas con amplios espacios, acabados de lujo y una terraza panorámica ideal para disfrutar del atardecer frente al mar.',
        caracteristicas: ['Piscina privada', 'Jardín', 'Estacionamiento para 2 autos', 'Cocina integral', 'Seguridad 24/7']
    },
    {
        id: 'demo-2', codigo: 'MY-002', titulo: 'Apartamento de Lujo en el Centro',
        tipo: 'Apartamento', ubicacion: 'Centro', precio: 120000, habitaciones: 2, banos: 2, area: 120,
        imagen: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
        badge: 'Nueva', badgeClass: 'new', destacada: true,
        descripcion: 'Moderno apartamento en el corazón de la ciudad, a pasos de comercios, restaurantes y transporte.',
        caracteristicas: ['Ascensor', 'Balcón', 'Gimnasio', 'Área social', 'Planta eléctrica']
    },
    {
        id: 'demo-3', codigo: 'MY-003', titulo: 'Casa Familiar en Zona Residencial',
        tipo: 'Casa', ubicacion: 'Zona Sur', precio: 180000, habitaciones: 3, banos: 2, area: 220,
        imagen: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80',
        badge: 'Bajó de Precio', badgeClass: '', destacada: false,
        descripcion: 'Acogedora casa familiar en una tranquila zona residencial, con jardín amplio.',
        caracteristicas: ['Jardín amplio', 'Family room', 'Lavandería', 'Estacionamiento techado', 'Cerca de colegios']
    },
    {
        id: 'demo-4', codigo: 'MY-004', titulo: 'Terreno con Excelente Ubicación',
        tipo: 'Terreno', ubicacion: 'Zona Norte', precio: 85000, habitaciones: 0, banos: 0, area: 500,
        imagen: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
        badge: 'Oportunidad', badgeClass: '', destacada: true,
        descripcion: 'Terreno plano y listo para construir, con todos los servicios básicos disponibles.',
        caracteristicas: ['Servicios básicos', 'Acceso pavimentado', 'Zonificación residencial', 'Título de propiedad']
    },
    {
        id: 'demo-5', codigo: 'MY-005', titulo: 'Penthouse con Terraza Panorámica',
        tipo: 'Apartamento', ubicacion: 'Centro', precio: 320000, habitaciones: 3, banos: 3, area: 180,
        imagen: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
        badge: 'Exclusiva', badgeClass: '', destacada: false,
        descripcion: 'Exclusivo penthouse con vistas de 360°, terraza privada y acabados premium.',
        caracteristicas: ['Terraza privada', 'Jacuzzi', 'Dos puestos de estacionamiento', 'Domótica', 'Concierge']
    },
    {
        id: 'demo-6', codigo: 'MY-006', titulo: 'Local Comercial en Avenida Principal',
        tipo: 'Local Comercial', ubicacion: 'Centro', precio: 95000, habitaciones: 0, banos: 1, area: 80,
        imagen: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80',
        badge: 'Inversión', badgeClass: '', destacada: false,
        descripcion: 'Local comercial con vitrina a avenida principal y alto tráfico peatonal.',
        caracteristicas: ['Vitrina a la calle', 'Alto tráfico', 'Baño privado', 'Aire acondicionado', 'Listo para operar']
    }
];

let TESTIMONIOS = [
    { nombre: 'María González', rol: 'Compradora', texto: 'Meyer\'s hizo que el proceso de compra de mi primera casa fuera increíblemente fácil. Mayerlyn y su equipo estuvieron pendientes de cada detalle.', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80' },
    { nombre: 'Carlos Rodríguez', rol: 'Vendedor', texto: 'Vendí mi propiedad en tiempo récord y al mejor precio del mercado. La valoración que hicieron fue precisa y profesional.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80' },
    { nombre: 'Ana Martínez', rol: 'Inversionista', texto: 'He realizado varias inversiones con Meyer\'s y siempre superan mis expectativas. Su conocimiento del mercado es invaluable.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80' },
    { nombre: 'Pedro Sánchez', rol: 'Comprador', texto: 'Excelente atención. Me ayudaron a encontrar exactamente lo que buscaba, dentro de mi presupuesto. 100% recomendados.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80' }
];

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

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', init);

async function init() {
    applyConfig();
    initReveal();
    initNavbar();
    initMobileMenu();
    initActiveNav();

    if (window.Auth) {
        currentUser = await window.Auth.getUser();
        if (currentUser) {
            const perfil = await window.Auth.getProfile(currentUser.id);
            if (perfil && perfil.bloqueado) {
                await window.db.auth.signOut();
                currentUser = null;
            }
        }
        window.Auth.renderAuthArea('#authArea');
    }
    catalogoPermitido = Boolean(currentUser);

    await cargarTestimonios();
    await cargarUbicacionesFiltro();
    if (catalogoPermitido) {
        await cargarPropiedades();
        await cargarFavoritos();
    }

    initProperties();
    initTestimonials();
    initContactForm();
    initSmoothScroll();
    initBackToTop();
    updateFavFloat();
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
            .select('*')
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
            .from('testimonials').select('*').order('sort_order', { ascending: true });
        if (data && data.length) {
            TESTIMONIOS = data.map((t) => ({ nombre: t.nombre, rol: t.rol, texto: t.texto, avatar: t.avatar }));
        }
    } catch (e) {
        console.warn('[Meyer\'s] No se pudieron cargar los testimonios:', e);
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
        ubicacion: p.ubicacion,
        precio: p.precio,
        habitaciones: p.habitaciones,
        banos: p.banos,
        area: p.area,
        imagen: p.imagen,
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

function cardTemplate(prop) {
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
                 aria-label="Ver detalle de ${escapeHtml(prop.titulo)}">
            <div class="property-image">
                ${badge}
                <button type="button" class="fav-btn ${activo}" data-fav="${escapeHtml(prop.id)}" aria-label="Guardar en favoritos">
                    <i class="fas fa-heart" aria-hidden="true"></i>
                </button>
                <img src="${escapeHtml(prop.imagen || PLACEHOLDER_IMG)}" alt="${escapeHtml(prop.titulo)}" loading="lazy"
                     onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
                <div class="property-price">${formatPrice(prop.precio)}</div>
            </div>
            <div class="property-content">
                <p class="property-type">${escapeHtml(prop.tipo)}</p>
                <h3 class="property-title">${escapeHtml(prop.titulo)}</h3>
                <p class="property-location"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${escapeHtml(prop.ubicacion)}</p>
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
    grid.innerHTML = lista.map(cardTemplate).join('');
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
    const tipo = $('#tipo')?.value || '';
    const ubicacion = $('#ubicacion')?.value || '';
    const precioOption = $('#precio')?.selectedOptions?.[0];
    const min = precioOption?.dataset.min ?? '';
    const max = precioOption?.dataset.max ?? '';

    state.visibles = PROPIEDADES.filter((prop) => {
        if (tipo && slug(prop.tipo) !== tipo) return false;
        if (ubicacion && slug(prop.ubicacion) !== ubicacion) return false;
        if (min !== '' && prop.precio < Number(min)) return false;
        if (max !== '' && prop.precio > Number(max)) return false;
        return true;
    });

    state.filtrosActivos = Boolean(tipo || ubicacion || min !== '' || max !== '');
    state.mostrarTodas = false;

    renderProperties(state.visibles);
    updateResultsBar();
    $('#propiedades')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
}

function showAll() {
    state.visibles = [...PROPIEDADES];
    state.filtrosActivos = false;
    state.mostrarTodas = true;
    renderProperties(state.visibles);
    updateResultsBar();
}

function resetFilters() { $('#searchForm')?.reset(); showAll(); }

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
            <img src="${escapeHtml(prop.imagen || PLACEHOLDER_IMG)}" alt="${escapeHtml(prop.titulo)}"
                 onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
            <div class="property-price">${formatPrice(prop.precio)}</div>
        </div>
        <div class="modal-content">
            <p class="property-type">${escapeHtml(prop.tipo)}</p>
            <h2 id="modalTitle">${escapeHtml(prop.titulo)}</h2>
            <div class="modal-meta"><span><i class="fas fa-map-marker-alt" aria-hidden="true"></i>${escapeHtml(prop.ubicacion)}</span></div>
            <p class="modal-description">${escapeHtml(prop.descripcion || '')}</p>
            <div class="modal-features">${features}</div>
            ${extras ? '<h3 style="margin:15px 0">Características</h3><div class="modal-features">' + extras + '</div>' : ''}
            <div class="modal-cta">
                <a href="https://wa.me/${CONFIG.whatsapp}?text=${waText}" class="btn btn-primary" target="_blank" rel="noopener noreferrer">
                    <i class="fab fa-whatsapp" aria-hidden="true"></i> Consultar por WhatsApp
                </a>
                <a href="#contacto" class="btn btn-outline" data-close-modal>Agendar visita</a>
            </div>
        </div>`;
}

/* ============================================================
   TESTIMONIOS
   ============================================================ */
function initTestimonials() {
    const slider = $('#testimonialsSlider');
    const dotsContainer = $('#sliderDots');
    if (!slider || !dotsContainer) return;

    slider.innerHTML = TESTIMONIOS.map((t) => `
        <div class="testimonial-card">
            <div class="testimonial-stars" aria-label="5 de 5 estrellas">★★★★★</div>
            <p class="testimonial-text">"${escapeHtml(t.texto)}"</p>
            <div class="testimonial-author">
                <img src="${escapeHtml(t.avatar || PLACEHOLDER_IMG)}" alt="${escapeHtml(t.nombre)}" class="testimonial-avatar" loading="lazy"
                     onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
                <div>
                    <p class="testimonial-name">${escapeHtml(t.nombre)}</p>
                    <p class="testimonial-role">${escapeHtml(t.rol || '')}</p>
                </div>
            </div>
        </div>`).join('');

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
function initNavbar() {
    const navbar = $('#navbar');
    if (!navbar) return;
    const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
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
   FORMULARIO DE CONTACTO (guarda en la tabla "leads")
   ============================================================ */
function initContactForm() {
    const form = $('#contactForm');
    if (!form) return;
    const status = $('#formStatus');
    const button = form.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;

    const setStatus = (message, type) => {
        if (!status) return;
        status.textContent = message;
        status.className = 'form-status' + (type ? ' ' + type : '');
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); setStatus('Por favor completa los campos obligatorios.', 'error'); return; }

        const datos = {
            nombre: $('#nombre').value.trim(),
            email: $('#email').value.trim(),
            telefono: $('#telefono').value.trim(),
            interes: $('#interes')?.value || null,
            mensaje: $('#mensaje')?.value.trim() || null
        };

        button.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Enviando...';
        button.disabled = true;
        setStatus('Enviando tu mensaje...', '');

        try {
            if (window.isSupabaseReady && window.isSupabaseReady()) {
                const { error } = await window.db.from('leads').insert(datos);
                if (error) throw error;
            } else {
                await new Promise((r) => setTimeout(r, 1000)); // simulación
            }
            button.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> ¡Mensaje Enviado!';
            setStatus(`¡Gracias, ${datos.nombre}! Hemos recibido tu mensaje. Un asesor te contactará pronto.`, 'success');
            setTimeout(() => { form.reset(); button.innerHTML = originalText; button.disabled = false; }, 1800);
        } catch (err) {
            button.innerHTML = originalText;
            button.disabled = false;
            setStatus('No se pudo enviar: ' + (err.message || err), 'error');
        }
    });
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

function initBackToTop() {
    const button = $('#backToTop');
    if (!button) return;
    button.hidden = false;
    const toggle = () => button.classList.toggle('visible', window.scrollY > 500);
    toggle();
    window.addEventListener('scroll', toggle, { passive: true });
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' }));
}
