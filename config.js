/* ============================================================
   CONFIGURACIÓN DE LA APLICACIÓN
   ------------------------------------------------------------
   👉 Pega aquí tus datos de Supabase:
      Supabase → Project Settings → API
        · Project URL      → supabaseUrl
        · anon public key  → supabaseAnonKey   (es pública, es seguro)

   ⚠️ NUNCA pongas la "service_role" key en este archivo.
   ============================================================ */
window.APP_CONFIG = {
    supabaseUrl: 'https://vtlwbarabdorfqbkohph.supabase.co',
    supabaseAnonKey: 'sb_publishable_AR1TwhuPFOzE9Q5J6A8AyA_FuzhBcW3',

    // Nombre del bucket de fotos (creado por schema.sql)
    bucket: 'propiedades',

    // Optimización automática de imágenes
    image: {
        maxWidth: 1200,         // ancho máximo de la foto grande (px)
        quality: 0.82,          // 0 = más comprimido / 1 = más calidad
        format: 'image/webp',   // formato web (más liviano)
        thumbWidth: 420,        // ancho de la miniatura (galería/tarjetas)
        thumbQuality: 0.7       // calidad de la miniatura
    },

    // Tipos de propiedad (lista única: la usan el catálogo y el panel)
    tiposPropiedad: [
        'Casa',
        'Quinta',
        'Apartamento',
        'Penthouse',
        'Suite',
        'Loft',
        'Townhouse',
        'Habitación',
        'Terreno',
        'Finca',
        'Local Comercial',
        'Oficina',
        'Consultorio',
        'Galpón',
        'Depósito',
        'Estacionamiento',
        'Edificio',
        'Hotel',
        'Posada'
    ],

    // Datos de contacto (se usan en la web y en WhatsApp)
    contacto: {
        whatsapp: '584141338254'
    },

    // ------------------------------------------------------------
    // CAPTCHA ANTI-ROBOTS (Cloudflare Turnstile) — gratis
    // ------------------------------------------------------------
    // 1) Crea tus llaves en: https://dash.cloudflare.com → Turnstile
    // 2) Pega aquí tu "Site Key" (la pública).
    // 3) En Supabase → Authentication → Attack Protection:
    //    activa CAPTCHA, proveedor Turnstile y pega tu "Secret Key".
    // Estas llaves son de PRUEBA (siempre dejan pasar):
    turnstile: {
        enabled: true,
        siteKey: '1x00000000000000000000AA'
    }
};
