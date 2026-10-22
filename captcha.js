/* ============================================================
   CAPTCHA ANTI-ROBOTS (Cloudflare Turnstile)
   ------------------------------------------------------------
   Muestra la verificación en el registro y en el ingreso.
   El token se envía a Supabase Auth, que lo valida contra
   Cloudflare (requiere activarlo en el panel de Supabase).

   Requiere: config.js (window.APP_CONFIG.turnstile)
   ============================================================ */
(function () {
    'use strict';

    const cfg = (window.APP_CONFIG && window.APP_CONFIG.turnstile) || {};
    const siteKey = cfg.siteKey || '';
    const activo = Boolean(cfg.enabled && siteKey);

    const Captcha = {
        activo,
        token: null,
        widgetId: null
    };

    /** Carga el script de Turnstile una sola vez. */
    Captcha.cargar = function () {
        if (!activo) return Promise.resolve();
        if (window.turnstile) return Promise.resolve();

        return new Promise((resolve, reject) => {
            window.__turnstileListo = () => resolve();

            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__turnstileListo';
            script.async = true;
            script.defer = true;
            script.onerror = () => reject(new Error('No se pudo cargar el captcha.'));
            document.head.appendChild(script);
        });
    };

    /** Dibuja el widget dentro del contenedor indicado. */
    Captcha.render = async function (selector) {
        if (!activo) return;

        try {
            await Captcha.cargar();
        } catch (e) {
            console.warn('[Meyer\'s] Captcha:', e.message);
            return;
        }

        const contenedor = document.querySelector(selector);
        if (!contenedor || !window.turnstile) return;

        Captcha.widgetId = window.turnstile.render(contenedor, {
            sitekey: siteKey,
            theme: 'light',
            size: 'flexible',
            language: 'es',
            // Solo aparece si Cloudflare detecta algo raro; si no, pasa invisible
            appearance: 'interaction-only',
            callback: (token) => { Captcha.token = token; },
            'expired-callback': () => { Captcha.token = null; },
            'error-callback': () => { Captcha.token = null; }
        });
    };

    /** Token actual ('' si el captcha está desactivado). */
    Captcha.getToken = function () {
        if (!activo) return '';
        return Captcha.token || '';
    };

    /**
     * Espera a que Cloudflare entregue el token (máximo `ms`).
     * Devuelve '' si no se pudo verificar.
     */
    Captcha.waitForToken = function (ms) {
        if (!activo) return Promise.resolve('');
        if (Captcha.token) return Promise.resolve(Captcha.token);

        return new Promise((resolve) => {
            const inicio = Date.now();
            const timer = window.setInterval(() => {
                if (Captcha.token) {
                    window.clearInterval(timer);
                    resolve(Captcha.token);
                } else if (Date.now() - inicio > (ms || 10000)) {
                    window.clearInterval(timer);
                    resolve('');
                }
            }, 150);
        });
    };

    /** Reinicia el widget (el token es de un solo uso). */
    Captcha.reset = function () {
        Captcha.token = null;
        if (window.turnstile && Captcha.widgetId != null) {
            try { window.turnstile.reset(Captcha.widgetId); } catch (e) { /* ignorar */ }
        }
    };

    window.Captcha = Captcha;
})();
