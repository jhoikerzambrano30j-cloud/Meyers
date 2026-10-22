# Meyer's Inmobiliaria — Sitio web + Panel de administración

Sitio web inmobiliario con **Supabase** como backend (base de datos, usuarios,
fotos y seguridad) y **JavaScript puro** en el frontend. Se despliega como sitio
estático en Vercel.

## Estructura

```
Proyecto/
├── index.html            Sitio público (inicio, propiedades, nosotros, servicios, contacto)
├── login.html            Ingreso de usuarios
├── registro.html         Crear cuenta (nombre, correo, teléfono)
├── cuenta.html           Área del usuario (datos, favoritos y comparador)
├── admin.html            Panel de administración (solo admin/master)
├── resena.html           Formulario público de reseñas (enlace de un uso)
├── 404.html              Página de error personalizada
├── manual-admin.html     Manual de la dueña (versión web)
├── MANUAL-ADMIN.pdf      Manual de la dueña (PDF)
├── styles.css            Estilos del sitio público
├── app.css               Estilos de auth, cuenta y panel admin
├── script.js             Lógica del sitio público (filtros, búsqueda, modal)
├── admin.js              Lógica del panel de administración
├── auth.js               Sesión, usuarios y favoritos (compartido)
├── supabase-client.js    Cliente de Supabase, precios e imágenes
├── config.js             👈 Claves de Supabase y datos de contacto
├── sw.js / manifest.json PWA (instalación en el teléfono)
├── sql/
│   ├── schema.sql        👈 Esquema completo (instalación nueva)
│   └── entrega-final.sql 👈 Migración final (proyecto ya existente)
├── fonts/                Master Of Break + Montserrat
└── img/                  Logo, favicon e imágenes
```

## Puesta en marcha (una sola vez)

1. **Crear las tablas en Supabase**
   - Proyecto nuevo: entra a **SQL Editor** → **New query**, pega todo
     `sql/schema.sql` y pulsa **Run**.
   - Proyecto que ya tenía datos: ejecuta `sql/entrega-final.sql` una vez.
     Agrega `about_content`, la columna `properties.operacion`, independiza
     zonas de ciudades, crea índices y los límites de master/administradores.
   - Esto crea: `profiles`, `properties`, `property_images`, `favorites`,
     `testimonials`, `services`, `site_settings`, `about_content`,
     `review_links`, el bucket de fotos `propiedades` y las políticas RLS.

2. **Pegar las claves**
   - Supabase → **Project Settings → API**.
   - Copia el **Project URL** y la **publishable/anon key**.
   - Pégalos en `config.js` (`supabaseUrl` y `supabaseAnonKey`).
   - ⚠️ La clave pública es segura en el frontend. NUNCA pongas la `service_role`.

3. **Hacerte master**
   - Regístrate primero en la web (`registro.html`) con tu correo.
   - Luego, en el **SQL Editor**, ejecuta (con tu correo real):
     ```sql
     update public.profiles set role = 'master'
     where id = (select id from auth.users where email = 'TU-CORREO@EJEMPLO.COM');
     ```
   - El primer master se crea por SQL. Los siguientes se otorgan desde
     **Usuarios** (máximo 3 master y 5 administradores).

4. **Subir a GitHub / Vercel**
   - Haz commit y push a la rama `Production`.
   - Si Vercel no publica automáticamente: **Deployments** → fila nueva →
     **`...`** → **Promote to Production**.
   - Después del despliegue, recarga con **Ctrl + F5**.

## Qué puede hacer cada rol

| Rol | Puede |
|---|---|
| Visitante | Ver la portada, servicios, reseñas y datos de contacto. **No ve el catálogo de propiedades.** |
| Usuario registrado | Ver propiedades, filtrar, usar la **búsqueda inteligente**, ver el detalle, guardar **favoritos**, comparar y editar sus datos |
| Administrador | Todo lo del usuario + crear/editar/cerrar propiedades, asesores, reseñas, contenido del sitio, secciones y servicios. Máximo 5 |
| Master | Todo el sistema + nombrar otros master. Máximo 3. No puede cambiar su propio rol ni su estado |

## Funciones principales

- **Catálogo privado:** solo usuarios con sesión iniciada ven las propiedades disponibles.
- **Filtros + búsqueda inteligente:** se combinan. Ejemplo: Ciudad **Caracas** +
  búsqueda **“con jacuzzi”** devuelve solo Caracas con jacuzzi. Los filtros
  activos se muestran como **chips** removibles.
- **Precios:** formato venezolano (`25.000,00`) con puntos de miles en tiempo
  real mientras se escribe, tanto en el panel como en el filtro Desde/Hasta.
- **Favoritos y comparador:** desde `cuenta.html`.
- **Reseñas:** enlace público de un solo uso, estrellas de 1 a 5 y aprobación
  del administrador antes de publicarse.
- **Panel autogestionable:** propiedades, usuarios, asesores, “Nuestra
  Historia”, contenido del sitio, títulos de secciones, servicios, reseñas,
  métricas e historial.
- **Formulario de propiedad estandarizado:** características en tarjetas
  uniformes, campos alineados y acciones de guardar/cancelar separadas.
- **PWA:** se puede instalar en el teléfono.
- **Página 404** personalizada con el diseño de la marca.
- **Móvil y tablet:** menú con la sesión integrada, buscador compacto, fotos en alta calidad según la pantalla, campos sin zoom automático en iPhone y botones táctiles de 44 px.
- **Sin diálogos nativos:** avisos y confirmaciones usan el diseño de la marca.
- **Contacto directo:** WhatsApp, teléfono y correo. No hay formulario de
  contacto ni bandeja de mensajes.

## Documentación

- **Manual de la dueña:** `manual-admin.html` (versión web) y `MANUAL-ADMIN.pdf`.
- **Historial:** la sección **14. Últimos cambios** del manual registra las mejoras.
- **Regla de mantenimiento:** cada cambio visible en la web o en el panel debe
  reflejarse en el manual y regenerar el PDF. Para hacerlo: abre
  `manual-admin.html` en Chrome → **Ctrl + P** → **Guardar como PDF**.

## Notas

- **Fotos:** al subirlas se redimensionan y convierten a **WebP** (versión
  grande + miniatura) para que la web cargue rápido.
- **Sesión:** se cierra automáticamente tras **10 minutos** de inactividad.
- **Historial:** las propiedades cerradas se conservan **2 meses**.
- **Sin Supabase configurado:** la web muestra datos de ejemplo en modo
  demostración; el catálogo real requiere sesión.
