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
                detectSessionInUrl: true,
                experimental: { passkey: true } // Face ID / huella (WebAuthn)
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

    /** Convierte un precio escrito (ej. "25.000,50") a número. */
    window.parsePrecio = function (valor) {
        let s = String(valor == null ? '' : valor).trim().replace(/\s/g, '');
        if (!s) return 0;

        if (s.includes(',')) {
            // coma decimal: se quitan los puntos de miles
            s = s.replace(/\./g, '').replace(',', '.');
        } else if ((s.match(/\./g) || []).length === 1 && /\.\d{1,2}$/.test(s)) {
            // punto decimal (ej. 5.5)
        } else {
            // puntos de miles (ej. 25.000)
            s = s.replace(/\./g, '');
        }

        const n = Number(s);
        return Number.isFinite(n) ? n : 0;
    };

    /** Formatea un número con puntos de miles y coma decimal (es-VE). */
    window.formatNumero = function (n) {
        const num = Number(n || 0);
        return num.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    /** Formatea un input de precio en tiempo real mientras se escribe. */
    window.formatearPrecioEnVivo = function (input) {
        if (!input) return;

        const pos = input.selectionStart == null ? input.value.length : input.selectionStart;
        const antes = input.value.slice(0, pos);
        const digitosAntes = (antes.match(/\d/g) || []).length;
        const tieneComa = input.value.includes(',');

        let [entera, decimal] = input.value.split(',');
        entera = (entera || '').replace(/\D/g, '');
        decimal = (decimal || '').replace(/\D/g, '').slice(0, 2);
        entera = entera.replace(/^0+(?=\d)/, '');

        const enteraFmt = entera
            ? Number(entera).toLocaleString('es-VE', { maximumFractionDigits: 0 })
            : '';

        let nuevo = enteraFmt;
        if (tieneComa) nuevo += ',' + decimal;
        if (!nuevo && tieneComa) nuevo = '0,';

        input.value = nuevo;

        // Restaurar el cursor después de la misma cantidad de dígitos
        let nuevoPos = 0;
        let contados = 0;
        if (digitosAntes === 0) {
            nuevoPos = nuevo.startsWith('0,') ? 2 : 0;
        } else {
            for (let i = 0; i < nuevo.length; i++) {
                if (/\d/.test(nuevo[i])) contados++;
                if (contados >= digitosAntes) { nuevoPos = i + 1; break; }
            }
            if (!nuevoPos) nuevoPos = nuevo.length;
        }

        if (tieneComa && decimal === '' && antes.endsWith(',')) nuevoPos = nuevo.length;

        try { input.setSelectionRange(nuevoPos, nuevoPos); } catch (e) { /* ignorar */ }
    };


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
