# Jazz en la Jungla

> Sitio web institucional y de inscripciones del retiro musical **Jazz en la Jungla**, celebrado en La Huerta Farm School, San Mateo, Alajuela, Costa Rica.
>
> Official website and registration platform for the **Jazz en la Jungla** music retreat at La Huerta Farm School, San Mateo, Alajuela, Costa Rica.

![Status](https://img.shields.io/badge/status-active-success)
![Stack](https://img.shields.io/badge/stack-AWS%20Serverless-orange)
![Frontend](https://img.shields.io/badge/frontend-Vanilla%20JS-yellow)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Tabla de contenidos · Table of contents

- [Español](#-en-español)
  - [Sobre el proyecto](#sobre-el-proyecto)
  - [Stack tecnológico](#stack-tecnológico)
  - [Arquitectura](#arquitectura)
  - [Estructura del repositorio](#estructura-del-repositorio)
  - [Funcionalidades clave](#funcionalidades-clave)
  - [Configuración](#configuración)
  - [Despliegue](#despliegue)
  - [Troubleshooting](#troubleshooting)
  - [Roadmap](#roadmap)
  - [Créditos](#créditos)
- [English](#-in-english)
  - [About](#about)
  - [Tech stack](#tech-stack)
  - [Architecture](#architecture)
  - [Repository layout](#repository-layout)
  - [Key features](#key-features)
  - [Configuration](#configuration)
  - [Deployment](#deployment)
  - [Troubleshooting](#troubleshooting-en)
  - [Roadmap](#roadmap-en)
  - [Credits](#credits)

---

## 🇪🇸 En español

### Sobre el proyecto

**Jazz en la Jungla** es un retiro musical íntimo de jazz, gastronomía y naturaleza que reúne a vocalistas e instrumentistas de todo el mundo en la selva tropical de Costa Rica. El retiro está guiado por la reconocida vocalista de jazz Cyrille Aimée junto a profesores de primer nivel.

Este repositorio contiene:

- **Frontend estático** (HTML / CSS / JavaScript vanilla, sin frameworks ni bundlers).
- **Dos funciones AWS Lambda** en Python 3.14 que gestionan las solicitudes de reserva y el reporte diario por email.
- **Infraestructura AWS serverless** documentada para reproducirla en otra cuenta.

El proyecto está optimizado para coste mínimo (todo dentro del free tier de AWS) y mantenimiento bajo.

### Stack tecnológico

**Frontend**

- HTML5 semántico + CSS3 con custom properties.
- JavaScript vanilla ES2020+ (sin React, Vue ni bundler).
- [intl-tel-input v23](https://github.com/jackocnr/intl-tel-input) para el selector internacional de teléfono.
- Google Fonts: *Playfair Display*, *Lato*, *Dancing Script*.

**Backend / Infraestructura AWS**

- **Amazon S3** — almacenamiento del sitio estático.
- **Amazon CloudFront** — CDN y HTTPS.
- **Amazon API Gateway** (HTTP API) — endpoint `POST /contacto`.
- **AWS Lambda** (Python 3.14, x86_64) — dos funciones:
  - `contactos-jazzenlajungla`: recibe el formulario, valida y guarda en DynamoDB.
  - `reporte-diario-jazzenlajungla`: genera CSV de solicitudes y lo envía por email.
- **Amazon DynamoDB** — tabla `Contactos-jazzenlajungla` (PK: `id` String).
- **Amazon SES** (`us-east-1`) — envío del reporte diario.
- **Amazon EventBridge Scheduler** — cron `0 9 * * ? *` que dispara el reporte diario.
- **GoDaddy** — registro de dominio y DNS (`jazzenlajungla.com`).

### Arquitectura

```
                          ┌─────────────────────────┐
                          │   Usuario (navegador)   │
                          └────────────┬────────────┘
                                       │ HTTPS
                          ┌────────────▼────────────┐
                          │   CloudFront (CDN)      │
                          │   www.jazzenlajungla.com│
                          └────────────┬────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │   S3 (sitio estático)   │
                          │   index.html · app.js · │
                          │   style.css · img/      │
                          └─────────────────────────┘

   Envío de formulario
   ───────────────────
   Navegador ──fetch POST──▶ API Gateway HTTP API
                                   │
                                   ▼
                       Lambda  contactos-jazzenlajungla
                                   │
                                   ├──▶ DynamoDB  Contactos-jazzenlajungla
                                   │
                                   └◀── { success: true, id: "<uuid>" }

   Reporte diario  (EventBridge cron · 09:00 UTC)
   ─────────────────────────────────────────────
   Scheduler ──invoca──▶ Lambda reporte-diario-jazzenlajungla
                                   │
                                   ├──▶ DynamoDB.scan()  ──▶ CSV
                                   │
                                   └──▶ Amazon SES  ──▶ email destinatarios
```

> Ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) para un detalle completo de flujos, decisiones técnicas y consideraciones de coste.

### Estructura del repositorio

```
01-jazz/
├── index.html                  # Página única (long-scroll)
├── app.js                      # Lógica frontend: idioma, formulario, slideshow, etc.
├── style.css                   # Estilos completos del sitio
├── img/                        # Imágenes (slides hero, artistas, ubicación, logo, etc.)
│   ├── slide.jpeg              # Slideshow del hero
│   ├── slide2.jpeg
│   ├── ...
│   ├── miniatura.png           # Open Graph preview (1200x630)
│   ├── Huerta.jpg              # Ubicación
│   └── ...
├── lambdas/
│   ├── dynamodb-lambda.py      # Lambda del formulario
│   └── reporte-diario-lambda.py# Lambda del reporte diario
├── README.md
├── ARCHITECTURE.md
├── LICENSE
└── .gitignore
```

### Funcionalidades clave

- **Single Page Application estática** con long-scroll y anclas de navegación.
- **Internacionalización (ES / EN)** mediante atributos `data-es` / `data-en` para textos y `data-ph-es` / `data-ph-en` para placeholders. Preferencia persistida en `localStorage`.
- **Slideshow del hero** con crossfade puro CSS + JS (5 slides rotando cada 5,5 s, respeta `prefers-reduced-motion`).
- **Formulario de reserva** con validación cliente (campos obligatorios, regex de email, edad mínima 18 años) y validación adicional servidor.
- **Teléfono internacional** con `intl-tel-input` y fallback defensivo: si `utils.js` no carga, se reconstruye el número manualmente con dialCode + dígitos crudos.
- **SEO + Open Graph + Twitter Card** completos para previews en WhatsApp, X, LinkedIn, etc.
- **Compatibilidad cross-browser** (Chrome / Safari / Firefox, desktop + iOS + Android) con resets explícitos de `appearance` en `<button>` y `<input type="date">`.

### Configuración

El frontend declara su única constante de configuración al inicio de `app.js`:

```js
const CONFIG = {
  API_URL: 'https://<API_GATEWAY_ID>.execute-api.us-east-1.amazonaws.com/contacto'
}
```

El placeholder `<API_GATEWAY_ID>` corresponde al identificador de la HTTP API desplegada.

Las dos Lambdas no requieren variables de entorno: las constantes (nombre de tabla, región de SES, remitente, destinatarios) están declaradas al inicio de cada archivo `lambdas/*.py`.

### Despliegue

#### Frontend (S3 + CloudFront)

```bash
# 1. Sincronizar archivos a S3
aws s3 cp index.html  s3://<S3_BUCKET>/index.html  --cache-control "max-age=60"
aws s3 cp app.js      s3://<S3_BUCKET>/app.js      --cache-control "max-age=300"
aws s3 cp style.css   s3://<S3_BUCKET>/style.css   --cache-control "max-age=300"
aws s3 sync img/      s3://<S3_BUCKET>/img/        --cache-control "max-age=86400"

# 2. Invalidar CloudFront
aws cloudfront create-invalidation \
  --distribution-id <CLOUDFRONT_DISTRIBUTION_ID> \
  --paths "/index.html" "/app.js" "/style.css"
```

> Cada cambio en `app.js` requiere incrementar el cache-buster `app.js?v=N` en `index.html` para forzar la recarga ante cabeceras de caché agresivas en CDN o navegador.

#### Lambdas

```bash
# Lambda del formulario
cd lambdas
zip dynamodb-lambda.zip dynamodb-lambda.py
aws lambda update-function-code \
  --function-name contactos-jazzenlajungla \
  --zip-file fileb://dynamodb-lambda.zip \
  --region us-east-1

# Lambda del reporte diario
zip reporte-diario-lambda.zip reporte-diario-lambda.py
aws lambda update-function-code \
  --function-name reporte-diario-jazzenlajungla \
  --zip-file fileb://reporte-diario-lambda.zip \
  --region us-east-1
```

#### Configuración inicial (one-time)

Detalles paso a paso en [`ARCHITECTURE.md`](./ARCHITECTURE.md):

1. Crear bucket S3 + bucket policy.
2. Crear distribución CloudFront con cert ACM.
3. Crear tabla DynamoDB.
4. Crear las dos Lambdas y el rol IAM con permisos sobre DynamoDB y SES.
5. Crear HTTP API en API Gateway con CORS habilitado.
6. Verificar dominio e identidades en SES.
7. Crear EventBridge Scheduler con el cron.
8. Configurar DNS en GoDaddy (CNAME `www` → CloudFront, forwarding del apex).

### Troubleshooting

**El formulario muestra "Error al enviar..." pero CloudWatch indica que la Lambda terminó OK.**
La Lambda devolvió un 400 por una validación (background > 4000, email mal formado, edad < 18, etc.). Las líneas `Body recibido:` y `Body parseado:` del log group `/aws/lambda/contactos-jazzenlajungla` muestran el payload exacto. Desde la versión `app.js?v=5`, el mensaje específico del backend se propaga al usuario.

**El teléfono llega vacío a DynamoDB.**
`intl-tel-input` puede devolver `""` desde `getNumber()` si `utils.js` aún no terminó de cargar. El frontend incluye un fallback que reconstruye el número con `dialCode + dígitos`. Si pese a ello el campo llega vacío, el `console.log('[JJL] phone a enviar:', phone)` deja visible en la consola del navegador el valor exacto enviado.

**El preview de WhatsApp solo funciona con `http://www.jazzenlajungla.com`.**
Tres capas combinadas: caché del scraper de Facebook (afecta también a WhatsApp), GoDaddy Domain Forwarding del apex sin SSL, y `og:url` mal apuntado. Solución: usar `og:url` `https://www.…/`, activar SSL forwarding en GoDaddy, y forzar re-scrape en `developers.facebook.com/tools/debug/`.

**Las cards "Tienda compartida / privada" se ven distintas en Safari iOS y Chrome.**
Los `<button>` traen `-webkit-appearance: button` que pinta gradiente nativo. La solución en `style.css` resetea `appearance` y `-webkit-appearance` a `none`, y hereda `color` y `font`.

**El input `<input type="date">` no muestra placeholder visible en iOS.**
iOS Safari pinta el placeholder nativo con opacidad casi imperceptible. El CSS aplica `:invalid::-webkit-datetime-edit { color: var(--text-light) }` para forzar legibilidad, y `min-height: 48px` para no colapsar la altura.

### Roadmap

- [ ] Activar SSL forwarding en GoDaddy para que `https://jazzenlajungla.com` (apex) también muestre preview de redes sociales.
- [ ] Salir del sandbox de Amazon SES (production access) para enviar emails de confirmación a clientes no verificados.
- [ ] Verificar el dominio `jazzenlajungla.com` en SES y migrar el remitente del reporte a `reportes@jazzenlajungla.com` (más SPF + MAIL FROM en GoDaddy).
- [ ] Mecanismo para que el equipo cambie el estado de las solicitudes (`pendiente` → `contactada` → `confirmada`) sin tocar DynamoDB directamente. Opciones en estudio: enlaces firmados HMAC en el email del reporte, mini panel admin con Basic Auth, o sync con Google Sheet.
- [ ] Filtrar el CSV diario para mostrar solo solicitudes en estado `pendiente`.

### Créditos

- **Concepto y dirección artística** — Socios fundadores de Jazz en la Jungla.
- **Vocalista invitada principal** — [Cyrille Aimée](https://www.cyrilleaimee.com/).
- **Ubicación** — La Huerta Farm School, San Mateo, Alajuela, Costa Rica.
- **Desarrollo web e infraestructura** — Juanma Escudier.

---

## 🇬🇧 In English

### About

**Jazz en la Jungla** is an intimate jazz, gastronomy and nature retreat that brings together vocalists and instrumentalists from around the world in the rainforest of Costa Rica. Led by acclaimed jazz vocalist Cyrille Aimée and a roster of top-tier instructors.

This repository contains:

- **Static frontend** (HTML / CSS / vanilla JavaScript, no frameworks or bundlers).
- **Two AWS Lambda functions** in Python 3.14 handling booking submissions and a daily email report.
- **Serverless AWS infrastructure** documented for reproduction in another account.

The project is optimized for minimal cost (everything inside AWS free tier) and low maintenance.

### Tech stack

**Frontend**

- Semantic HTML5 + CSS3 with custom properties.
- Vanilla ES2020+ JavaScript (no React, Vue or bundler).
- [intl-tel-input v23](https://github.com/jackocnr/intl-tel-input) for international phone selector.
- Google Fonts: *Playfair Display*, *Lato*, *Dancing Script*.

**Backend / AWS Infrastructure**

- **Amazon S3** — static site hosting.
- **Amazon CloudFront** — CDN and HTTPS.
- **Amazon API Gateway** (HTTP API) — `POST /contacto` endpoint.
- **AWS Lambda** (Python 3.14, x86_64) — two functions:
  - `contactos-jazzenlajungla`: receives form, validates and stores in DynamoDB.
  - `reporte-diario-jazzenlajungla`: generates CSV of submissions and emails it.
- **Amazon DynamoDB** — `Contactos-jazzenlajungla` table (PK: `id`, String).
- **Amazon SES** (`us-east-1`) — daily report delivery.
- **Amazon EventBridge Scheduler** — `0 9 * * ? *` cron triggering the daily report.
- **GoDaddy** — domain registrar and DNS (`jazzenlajungla.com`).

### Architecture

```
                          ┌─────────────────────────┐
                          │   User (browser)        │
                          └────────────┬────────────┘
                                       │ HTTPS
                          ┌────────────▼────────────┐
                          │   CloudFront (CDN)      │
                          │   www.jazzenlajungla.com│
                          └────────────┬────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │   S3 (static site)      │
                          │   index.html · app.js · │
                          │   style.css · img/      │
                          └─────────────────────────┘

   Form submission
   ───────────────
   Browser ──fetch POST──▶ API Gateway HTTP API
                                   │
                                   ▼
                       Lambda  contactos-jazzenlajungla
                                   │
                                   ├──▶ DynamoDB  Contactos-jazzenlajungla
                                   │
                                   └◀── { success: true, id: "<uuid>" }

   Daily report  (EventBridge cron · 09:00 UTC)
   ─────────────────────────────────────────────
   Scheduler ──invokes──▶ Lambda reporte-diario-jazzenlajungla
                                   │
                                   ├──▶ DynamoDB.scan()  ──▶ CSV
                                   │
                                   └──▶ Amazon SES  ──▶ recipients
```

> See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for full flow details, technical decisions and cost considerations.

### Repository layout

```
01-jazz/
├── index.html                  # Single page (long-scroll)
├── app.js                      # Frontend logic: i18n, form, slideshow, etc.
├── style.css                   # Full site styles
├── img/                        # Images (hero slides, artists, location, logo, etc.)
├── lambdas/
│   ├── dynamodb-lambda.py      # Form Lambda
│   └── reporte-diario-lambda.py# Daily report Lambda
├── README.md
├── ARCHITECTURE.md
├── LICENSE
└── .gitignore
```

### Key features

- **Static SPA** with long-scroll layout and anchor navigation.
- **Internationalization (ES / EN)** via `data-es` / `data-en` for text content and `data-ph-es` / `data-ph-en` for input placeholders. User preference persisted in `localStorage`.
- **Hero slideshow** with pure CSS crossfade + JS rotation (5 slides every 5.5 s, honors `prefers-reduced-motion`).
- **Booking form** with client-side validation (required fields, email regex, 18+ age check) plus server-side validation.
- **International phone input** powered by `intl-tel-input`, with a defensive fallback that reconstructs the number from `dialCode + raw digits` if `utils.js` hasn't loaded yet.
- **Complete SEO + Open Graph + Twitter Card** for previews in WhatsApp, X, LinkedIn, etc.
- **Cross-browser hardening** (Chrome / Safari / Firefox, desktop + iOS + Android) with explicit `appearance` resets on `<button>` and `<input type="date">`.

### Configuration

The frontend declares its single configuration constant at the top of `app.js`:

```js
const CONFIG = {
  API_URL: 'https://<API_GATEWAY_ID>.execute-api.us-east-1.amazonaws.com/contacto'
}
```

The `<API_GATEWAY_ID>` placeholder corresponds to the identifier of the deployed HTTP API.

The Lambdas do not require environment variables: all constants (table name, SES region, sender, recipients) are declared at the top of each `lambdas/*.py` file.

### Deployment

#### Frontend (S3 + CloudFront)

```bash
# 1. Sync files to S3
aws s3 cp index.html  s3://<S3_BUCKET>/index.html  --cache-control "max-age=60"
aws s3 cp app.js      s3://<S3_BUCKET>/app.js      --cache-control "max-age=300"
aws s3 cp style.css   s3://<S3_BUCKET>/style.css   --cache-control "max-age=300"
aws s3 sync img/      s3://<S3_BUCKET>/img/        --cache-control "max-age=86400"

# 2. Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id <CLOUDFRONT_DISTRIBUTION_ID> \
  --paths "/index.html" "/app.js" "/style.css"
```

> Every change to `app.js` requires incrementing the cache-buster `app.js?v=N` in `index.html` to force a reload against aggressive caching headers at the CDN or browser.

#### Lambdas

```bash
# Form Lambda
cd lambdas
zip dynamodb-lambda.zip dynamodb-lambda.py
aws lambda update-function-code \
  --function-name contactos-jazzenlajungla \
  --zip-file fileb://dynamodb-lambda.zip \
  --region us-east-1

# Daily report Lambda
zip reporte-diario-lambda.zip reporte-diario-lambda.py
aws lambda update-function-code \
  --function-name reporte-diario-jazzenlajungla \
  --zip-file fileb://reporte-diario-lambda.zip \
  --region us-east-1
```

#### Initial setup (one-time)

Step-by-step details in [`ARCHITECTURE.md`](./ARCHITECTURE.md):

1. Create S3 bucket + bucket policy.
2. Create CloudFront distribution with ACM cert.
3. Create DynamoDB table.
4. Create both Lambdas and IAM role with permissions for DynamoDB and SES.
5. Create HTTP API on API Gateway with CORS enabled.
6. Verify domain and identities in SES.
7. Create EventBridge Scheduler with the cron.
8. Configure DNS in GoDaddy (CNAME `www` → CloudFront, apex forwarding).

### Troubleshooting <a id="troubleshooting-en"></a>

**The form shows "Submission failed..." but CloudWatch indicates that the Lambda finished OK.**
The Lambda returned a 400 due to validation (background > 4000, malformed email, age < 18, etc.). The `Body recibido:` and `Body parseado:` log lines in CloudWatch log group `/aws/lambda/contactos-jazzenlajungla` contain the exact payload received. Since `app.js?v=5`, the backend-specific error message is propagated to the user.

**Phone arrives empty in DynamoDB.**
`intl-tel-input` may return `""` from `getNumber()` if `utils.js` has not fully loaded. The frontend includes a fallback that reconstructs the number with `dialCode + digits`. If the field still arrives empty, the `console.log('[JJL] phone a enviar:', phone)` line exposes the actual value sent in the browser console.

**WhatsApp preview only works with `http://www.jazzenlajungla.com`.**
Three combined causes: Facebook scraper cache (also affects WhatsApp), GoDaddy apex Domain Forwarding without SSL, and `og:url` pointing wrong. Fix: set `og:url` to `https://www.…/`, enable SSL forwarding in GoDaddy, force re-scrape at `developers.facebook.com/tools/debug/`.

**"Shared / private tent" cards render differently in Safari iOS vs Chrome.**
`<button>` carries `-webkit-appearance: button` which paints a native gradient. The fix in `style.css` resets `appearance` and `-webkit-appearance` to `none`, and inherits `color` and `font`.

**`<input type="date">` does not show a visible placeholder on iOS.**
iOS Safari renders the native placeholder with nearly invisible opacity. The CSS applies `:invalid::-webkit-datetime-edit { color: var(--text-light) }` to force legibility, and `min-height: 48px` to prevent height collapse.

### Roadmap <a id="roadmap-en"></a>

- [ ] Enable SSL forwarding in GoDaddy so `https://jazzenlajungla.com` (apex) also shows social previews.
- [ ] Move out of Amazon SES sandbox (production access) to send confirmation emails to unverified customers.
- [ ] Verify the `jazzenlajungla.com` domain in SES and migrate the report sender to `reportes@jazzenlajungla.com` (plus SPF + MAIL FROM in GoDaddy).
- [ ] Mechanism for the team to update request status (`pending` → `contacted` → `confirmed`) without touching DynamoDB directly. Options under study: HMAC-signed links in report emails, mini admin panel with Basic Auth, or Google Sheet sync.
- [ ] Filter the daily CSV to include only `pending` submissions.

### Credits

- **Concept and artistic direction** — Jazz en la Jungla founding partners.
- **Featured guest vocalist** — [Cyrille Aimée](https://www.cyrilleaimee.com/).
- **Location** — La Huerta Farm School, San Mateo, Alajuela, Costa Rica.
- **Web development & infrastructure** — Juanma Escudier.

---

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE).
