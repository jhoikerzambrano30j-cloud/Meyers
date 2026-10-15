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
        ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
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

        if (!file || !file.type.startsWith('image/')) return file;

        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
        } catch (e) {
            return file; // el navegador no pudo leerla, se sube tal cual
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

        let blob = await toBlob('image/webp', quality);
        if (!blob) blob = await toBlob('image/jpeg', quality); // respaldo
        return blob || file;
    };

    /** Sube un archivo al bucket y devuelve { url, path }. */
    window.subirImagen = async function (fileOrBlob, extension) {
        if (!window.isSupabaseReady()) throw new Error('Supabase no está configurado.');

        const ext = extension || (fileOrBlob.type === 'image/webp' ? 'webp'
            : fileOrBlob.type === 'image/jpeg' ? 'jpg' : 'png');

        const nombre = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) + '.' + ext;
        const cfg = window.APP_CONFIG;
        const { error } = await window.db.storage
            .from(cfg.bucket)
            .upload(nombre, fileOrBlob, { contentType: fileOrBlob.type || 'image/webp' });

        if (error) throw error;

        const { data } = window.db.storage.from(cfg.bucket).getPublicUrl(nombre);
        return { url: data.publicUrl, path: nombre };
    };
})();
