/* ============================================================
   AUTENTICACIÓN Y FAVORITOS (compartido por todas las páginas)
   ============================================================ */
(function () {
    'use strict';

    const Auth = {};

    /** Usuario actual (o null). */
    Auth.getUser = async function () {
        if (!window.isSupabaseReady()) return null;
        const { data } = await window.db.auth.getSession();
        return data.session ? data.session.user : null;
    };

    /** Perfil del usuario actual (o null). */
    Auth.getProfile = async function (userId) {
        if (!window.isSupabaseReady()) return null;
        const id = userId || (await Auth.getUser())?.id;
        if (!id) return null;
        const { data } = await window.db.from('profiles').select('*').eq('id', id).maybeSingle();
        return data || null;
    };

    /** ¿Es administrador? */
    Auth.isAdmin = async function () {
        const profile = await Auth.getProfile();
        return Boolean(profile && profile.role === 'admin');
    };

    // ------------------------------------------------------------
    // Registro / ingreso / salida
    // ------------------------------------------------------------
    Auth.signUp = async function ({ email, password, fullName, phone }) {
        if (!window.isSupabaseReady()) throw new Error('Supabase no está configurado.');
        return window.db.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName || '', phone: phone || '' },
                emailRedirectTo: window.location.origin + '/login.html'
            }
        });
    };

    Auth.signIn = async function (email, password) {
        if (!window.isSupabaseReady()) throw new Error('Supabase no está configurado.');
        return window.db.auth.signInWithPassword({ email, password });
    };

    Auth.signOut = async function () {
        if (window.isSupabaseReady()) await window.db.auth.signOut();
        window.location.href = 'index.html';
    };

    // ------------------------------------------------------------
    // Protección de páginas
    // ------------------------------------------------------------
    Auth.requireAuth = async function (redirect) {
        const user = await Auth.getUser();
        if (!user) { window.location.href = redirect || 'login.html'; return null; }
        return user;
    };

    Auth.requireAdmin = async function () {
        const user = await Auth.getUser();
        if (!user) { window.location.href = 'login.html'; return null; }
        const profile = await Auth.getProfile(user.id);
        if (!profile || profile.role !== 'admin') {
            window.location.href = 'index.html';
            return null;
        }
        return { user, profile };
    };

    // ------------------------------------------------------------
    // Favoritos
    // ------------------------------------------------------------
    Auth.getFavorites = async function () {
        if (!window.isSupabaseReady()) return [];
        const user = await Auth.getUser();
        if (!user) return [];
        const { data } = await window.db.from('favorites').select('property_id');
        return (data || []).map((r) => r.property_id);
    };

    /** Devuelve true si quedó marcado, false si se quitó. */
    Auth.toggleFavorite = async function (propertyId) {
        if (!window.isSupabaseReady()) throw new Error('Supabase no está configurado.');
        const user = await Auth.getUser();
        if (!user) { const e = new Error('login'); e.needLogin = true; throw e; }

        const { data } = await window.db.from('favorites')
            .select('property_id').eq('property_id', propertyId).maybeSingle();

        if (data) {
            await window.db.from('favorites').delete().eq('property_id', propertyId);
            return false;
        }
        await window.db.from('favorites').insert({ property_id: propertyId });
        return true;
    };

    // ------------------------------------------------------------
    // Barra de navegación (estado de sesión)
    // ------------------------------------------------------------
    Auth.renderAuthArea = async function (selector) {
        const area = document.querySelector(selector || '#authArea');
        if (!area) return;

        const user = await Auth.getUser();
        if (!user) {
            area.innerHTML =
                '<a class="nav-auth-link" href="login.html">Ingresar</a>' +
                '<a class="nav-auth-link nav-auth-primary" href="registro.html">Crear cuenta</a>';
            return;
        }

        const profile = await Auth.getProfile(user.id);
        const nombre = (profile && profile.full_name) ? profile.full_name.split(' ')[0] : 'Mi cuenta';
        const esAdmin = profile && profile.role === 'admin';

        area.innerHTML =
            (esAdmin ? '<a class="nav-auth-link" href="admin.html"><i class="fas fa-user-shield"></i> Admin</a>' : '') +
            '<a class="nav-auth-link" href="cuenta.html"><i class="fas fa-user"></i> ' + escapeHtmlLocal(nombre) + '</a>' +
            '<button type="button" class="nav-auth-link nav-auth-out" id="logoutBtn">Salir</button>';

        const btn = area.querySelector('#logoutBtn');
        if (btn) btn.addEventListener('click', () => Auth.signOut());
    };

    function escapeHtmlLocal(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    window.Auth = Auth;
})();
