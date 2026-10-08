# Meyer's Real Estate — Sitio web

Sitio inmobiliario de una sola página construido con HTML, CSS y JavaScript
vanilla (sin dependencias de build). Mejora y corrección del proyecto original.

## Contenido

```
Proyecto/
├── index.html   Estructura y contenido
├── styles.css   Estilos, identidad de marca y responsive
├── script.js    Datos, filtros, modal, slider y formulario
└── README.md    Este archivo
```

## Cómo ejecutarlo

1. Abre `index.html` con doble clic en tu navegador, o
2. Sírvelo en local (recomendado para rutas y fuentes):

```bash
# Con Python instalado
python -m http.server 5500
# Luego abre http://localhost:5500
```

## Identidad de marca

Los valores de color y tipografía se mantienen según el manual de identidad:

| Token        | Valor     | Uso                    |
|--------------|-----------|------------------------|
| `--gold`     | `#E1BD45` | Dorado principal       |
| `--gold-dark`| `#B89A2E` | Hover / acentos        |
| `--silver`   | `#9D9D9C` | Textos secundarios     |
| `--off-white`| `#F5F5F5` | Fondos alternos        |
| `--dark`     | `#1A1A1A` | Textos / fondos oscuros|

Tipografías: **Montserrat** (cuerpo) y **Great Vibes** (script de marca).

## Errores corregidos del código original

1. **Insignia "Desde 2020"**: el HTML mostraba `20` dos veces en lugar del año.
2. **Buscador sin resultados**: renderizaba todas las propiedades y luego las
   sobrescribía con el mensaje. Ahora renderiza solo los resultados y muestra un
   estado vacío con acción para limpiar los filtros.
3. **Error de JavaScript con `href="#"`**: `querySelector('#')` lanzaba
   `SyntaxError` en logo, redes y "Ver todas". Ahora se controla y no rompe.
4. **Botón "Ver todas las propiedades"**: no hacía nada. Ahora muestra el
   catálogo completo y oculta los filtros.
5. **Filtro de precio**: se interpretaba texto frágil (`"200000+"`). Ahora usa
   `data-min` / `data-max` en cada opción.
6. **Imágenes roscas/imágenes rotas**: se añadió `onerror` con imagen de respaldo
   (SVG embebido sin comillas conflictivas).
7. **Menú móvil**: no bloqueaba el scroll, no cerraba con ESC ni al pulsar
   fuera, y la hamburguesa no se animaba. Todo corregido.
8. **`[hidden]` anulado por el CSS**: los componentes con `display:flex`
   ignoraban el atributo `hidden`; se añadió una regla global.
9. **Inyección de HTML**: todo el contenido dinámico pasa por `escapeHtml()`.
10. **Validación del formulario**: se sustituye el `alert()` por un mensaje
    inline accesible y validación nativa.
11. **Insignias de precio/badge**: se conserva el estilo y se normaliza la clase.

## Mejoras añadidas

- **Modal de detalle** de propiedad con características, accesos de teclado,
  trampa de foco, cierre con ESC y CTA a WhatsApp con mensaje prellenado.
- **Buscador** con barra de resultados ("X propiedades encontradas") y botón
  para limpiar filtros.
- **Slider de testimonios** con autoplay, pausa al pasar el ratón/foco,
  sincronización de puntos y respeto a `prefers-reduced-motion`.
- **Navegación activa** según la sección visible (IntersectionObserver).
- **Animaciones de aparición** al hacer scroll, con soporte de movimiento
  reducido.
- **Botón "volver arriba"** y WhatsApp con mensaje predefinido.
- **Accesibilidad**: enlace "saltar al contenido", `aria-*`, foco visible,
  etiquetas para lectores de pantalla y atributos `alt` descriptivos.
- **SEO/social**: `theme-color`, Open Graph, favicon SVG embebido y metadatos.
- **Configuración centralizada** del teléfono, correo y WhatsApp en
  `CONFIG`, dentro de `script.js`.

## Cómo personalizar

- **Propiedades y testimonios**: edita los arrays `PROPIEDADES` y `TESTIMONIOS`
  al inicio de `script.js`.
- **Datos de contacto**: edita el objeto `CONFIG` en `script.js`.
- **Formulario de contacto**: la función `initContactForm()` incluye un
  comentario donde conectar tu backend o servicio de correo (Formspree,
  EmailJS, etc.).
- **Logo y foto de la CEO**: reemplaza los comentarios `<!-- Reemplazar ... -->`
  en `index.html` por las imágenes reales.
