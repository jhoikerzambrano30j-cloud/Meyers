/* ============================================================
   CLIENTE DE SUPABASE
   Crea window.db (el cliente) y helpers compartidos.
   Requiere haber cargado antes:
     - @supabase/supabase-js (UMD)
     - config.js
   ============================================================ */
(function () {
    'use strict';

    const cfg = window.APP_CONFIG || {};
    const hasLib = typeof window.supabase !== 'undefined' && window.supabase.createClient;
    const hasKeys = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);

    window.db = (hasLib && hasKeys)
        ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
            auth: {
                storage: window.sessionStorage, // la sesión termina al cerrar el navegador
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        })
        : null;

    /** ¿Está Supabase configurado y disponible? */
    window.isSupabaseReady = function () {
        return Boolean(window.db);
    };

    /** Aviso visible cuando faltan las claves (solo desarrollo). */
    window.warnSupabaseMissing = function () {
        if (window.isSupabaseReady()) return;
        console.warn(
            '[Meyer\'s] Supabase no está configurado todavía. ' +
            'Abre config.js y pega tu Project URL y tu anon key. ' +
            'Mientras tanto la web usa datos de ejemplo.'
        );
    };

    // ------------------------------------------------------------
    // Utilidades compartidas
    // ------------------------------------------------------------

    /** Convierte un archivo de imagen a WebP optimizado. */
    window.optimizarImagen = async function (file, options) {
        const opts = (window.APP_CONFIG && window.APP_CONFIG.image) || {};
        const maxWidth = (options && options.maxWidth) || opts.maxWidth || 1600;
        const quality = (options && options.quality) || opts.quality || 0.8;

        if (!file || !file.type || !file.type.startsWith('image/')) {
            throw new Error('El archivo no es una imagen válida.');
        }

        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
        } catch (e) {
            // Si el navegador no puede leerla, NO se sube el original (evita archivos pesados)
            throw new Error('No se pudo procesar la imagen. Usa JPG, PNG o WebP.');
        }

        let { width, height } = bitmap;
        if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, width, height);
        if (bitmap.close) bitmap.close();

        const toBlob = (type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));

        // Siempre se guarda optimizada (WebP; JPEG solo como respaldo)
        let blob = await toBlob('image/webp', quality);
        if (!blob) blob = await toBlob('image/jpeg', quality);
        if (!blob) throw new Error('No se pudo optimizar la imagen.');
        return blob;
    };

    /** Sube un archivo al bucket y devuelve { url, path }. */
    window.subirImagen = async function (fileOrBlob, extension) {
        if (!window.isSupabaseReady()) throw new Error('Supabase no está configurado.');

        const tipo = fileOrBlob.type || 'image/webp';
        const ext = extension || (tipo === 'image/webp' ? 'webp'
            : tipo === 'image/jpeg' ? 'jpg'
            : tipo === 'image/png' ? 'png'
            : 'webp');

        const nombre = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) + '.' + ext;
        const cfg = window.APP_CONFIG;
        const { error } = await window.db.storage
            .from(cfg.bucket)
            .upload(nombre, fileOrBlob, { contentType: tipo });

        if (error) throw error;

        const { data } = window.db.storage.from(cfg.bucket).getPublicUrl(nombre);
        return { url: data.publicUrl, path: nombre };
    };
    // ------------------------------------------------------------
    // PWA: registrar el Service Worker (permite INSTALAR la app)
    // ------------------------------------------------------------
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        });
    }
})();
