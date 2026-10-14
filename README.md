# Meyer's Inmobiliaria — Sitio web + Panel de administración

Sitio web inmobiliario con **Supabase** como backend (base de datos, usuarios,
fotos y seguridad) y **JavaScript puro** en el frontend. Se despliega como sitio
estático en Vercel.

## Estructura

```
Proyecto/
├── index.html            Sitio público (inicio, propiedades, contacto)
├── login.html            Ingreso de usuarios
├── registro.html         Crear cuenta (nombre, correo, teléfono)
├── cuenta.html           Área del usuario (sus datos + favoritos)
├── admin.html            Panel de administración (solo admin)
├── styles.css            Estilos del sitio público
├── app.css               Estilos de auth, cuenta y panel admin
├── script.js             Lógica del sitio público
├── admin.js              Lógica del panel de administración
├── auth.js               Sesión, usuarios y favoritos (compartido)
├── supabase-client.js    Cliente de Supabase + optimización de imágenes
├── config.js             👈 AQUÍ van tus claves de Supabase
├── sql/
│   └── schema.sql        👈 Base de datos completa (tablas, RLS, storage)
├── fonts/                Master Of Break + Montserrat
└── img/                  Logo y favicon
```

## Puesta en marcha (una sola vez)

1. **Crear las tablas en Supabase**
   - Entra a tu proyecto de Supabase → **SQL Editor** → **New query**.
   - Copia TODO el contenido de `sql/schema.sql` y pulsa **Run**.
   - Esto crea: `profiles`, `properties`, `property_images`, `favorites`,
     `testimonials`, `leads`, el bucket de fotos `propiedades` y todas las
     políticas de seguridad (RLS).

2. **Pegar las claves**
   - Supabase → **Project Settings → API**.
   - Copia el **Project URL** y la **anon public key**.
   - Pégalos en `config.js` (`supabaseUrl` y `supabaseAnonKey`).
   - ⚠️ La `anon key` es pública. NUNCA pongas la `service_role`.

3. **Hacerte administrador**
   - Regístrate primero en la web (`registro.html`) con tu correo.
   - Luego, en el **SQL Editor**, ejecuta (con tu correo real):
     ```sql
     update public.profiles set role = 'admin'
     where id = (select id from auth.users where email = 'TU-CORREO@EJEMPLO.COM');
     ```

4. **Subir a GitHub / Vercel**
   - Haz commit y push. Vercel despliega solo.

## Qué puede hacer cada rol

| Rol | Puede |
|---|---|
| Visitante | Ver el sitio, servicios, testimonios y enviar el formulario de contacto. **No ve el catálogo de propiedades.** |
| Usuario registrado | Ver las propiedades, filtrar, ver el detalle, guardar **favoritos** y editar sus datos |
| Administrador | Todo + crear/editar/borrar propiedades, subir fotos, ver usuarios y mensajes, **exportar a CSV** |

## Notas

- **Fotos**: al subirlas en el panel, se **redimensionan a 1600 px y se
  convierten a WebP** automáticamente antes de guardarse, para que pesen menos.
- **Usuarios**: cada registro guarda nombre, correo y teléfono. El admin los ve
  y los exporta desde la pestaña **Usuarios**.
- **Sin Supabase configurado**, la web muestra propiedades de ejemplo y el
  formulario de contacto simula el envío (modo demostración).
