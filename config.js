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
        maxWidth: 1600,         // ancho máximo en px
        quality: 0.8,           // 0 = más comprimido / 1 = más calidad
        format: 'image/webp'    // formato web (más liviano)
    },

    // Datos de contacto (se usan en la web y en WhatsApp)
    contacto: {
        whatsapp: '584140000000'
    }
};
