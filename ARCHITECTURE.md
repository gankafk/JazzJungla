# Architecture · Jazz en la Jungla

Documento técnico que complementa al [README](./README.md). Detalla la arquitectura AWS, los flujos de datos, las decisiones técnicas y consideraciones de coste, seguridad y operación.

> Bilingüe / Bilingual — secciones en español primero, English version below each block when relevant.

---

## 1. Visión general · Overview

El sitio es 100 % **serverless**: no hay servidores propios que administrar ni mantener. Toda la infraestructura es código gestionado de AWS, con dominio externo en GoDaddy.

The site is 100 % **serverless**: no self-managed servers. All infrastructure is AWS-managed, with the domain registered at GoDaddy.

### Principios de diseño

- **Coste mínimo**. Todos los servicios están dimensionados dentro del free tier de AWS o pagando por consumo real. Estimado < 1 USD/mes con volumen actual.
- **Sin frameworks pesados**. Vanilla JS evita coste de build, dependencias y vulnerabilidades de cadena de suministro.
- **Operativo desde un solo idioma de despliegue** (AWS CLI). Puede migrarse a IaC (SAM/CDK/Terraform) en el futuro sin reescribir.
- **Separación clara**: frontend estático y dos Lambdas con única responsabilidad.

---

## 2. Diagrama detallado · Detailed diagram

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │                              INTERNET                                │
 └──────────────────────────────────┬──────────────────────────────────┘
                                    │
                                    │  DNS lookup
                                    ▼
                ┌──────────────────────────────────────┐
                │  GoDaddy DNS                         │
                │  · www.jazzenlajungla.com  → CNAME ──┼───▶ CloudFront
                │  · jazzenlajungla.com (apex) → 301 ──┼───▶ www (HTTPS)
                └──────────────────────────────────────┘
                                    │
                                    ▼
                ┌──────────────────────────────────────┐
                │  Amazon CloudFront                   │
                │  · ACM cert (www + apex)             │
                │  · HTTP → HTTPS redirect             │
                │  · Default behavior → S3 origin      │
                └──────────────────┬───────────────────┘
                                   │
                                   ▼
                ┌──────────────────────────────────────┐
                │  Amazon S3                           │
                │  · Bucket policy: read only desde CF │
                │  · index.html, app.js, style.css, img│
                └──────────────────────────────────────┘


  ┌──────────────────── INSCRIPCIÓN (POST /contacto) ────────────────────┐
  │                                                                      │
  │    Browser                                                           │
  │       │ fetch POST { name, email, dob, country, phone, edition,     │
  │       │             accommodation, background, howHeard, consent }   │
  │       ▼                                                              │
  │   Amazon API Gateway (HTTP API)                                      │
  │   · CORS allow-origin: https://www.jazzenlajungla.com                │
  │   · Route: POST /contacto                                            │
  │       │                                                              │
  │       ▼                                                              │
  │   AWS Lambda  contactos-jazzenlajungla  (Python 3.14)                │
  │   · Valida payload (regex email, edad ≥ 18, longitudes, etc.)        │
  │   · Construye item con uuid + timestamp + estado=pendiente           │
  │   · table.put_item(Item=item)                                        │
  │       │                                                              │
  │       ▼                                                              │
  │   Amazon DynamoDB  Contactos-jazzenlajungla                          │
  │   · PK: id (String)                                                  │
  │   · Otros: name, email, dob, edad, country, phone, edition,          │
  │           accommodation, background, howHeard, consent,              │
  │           estado, ip_origen, user_agent, timestamp, fecha_creacion   │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘


  ┌───────────────── REPORTE DIARIO (cron 09:00 UTC) ────────────────────┐
  │                                                                      │
  │    Amazon EventBridge Scheduler                                      │
  │    · cron(0 9 * * ? *)                                               │
  │       │                                                              │
  │       ▼                                                              │
  │    AWS Lambda  reporte-diario-jazzenlajungla  (Python 3.14)          │
  │    · table.scan() para leer todas las solicitudes                    │
  │    · Genera CSV en memoria                                           │
  │    · Construye email multipart (HTML + attachment CSV)               │
  │       │                                                              │
  │       ▼                                                              │
  │    Amazon SES (us-east-1)                                            │
  │    · Identidad verificada (email actualmente; dominio en proceso)    │
  │    · ses.send_raw_email() con boto3                                  │
  │       │                                                              │
  │       ▼                                                              │
  │    Destinatarios (socios)                                            │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Servicios y configuración · Services & configuration

### 3.1 Amazon S3

| Parámetro | Valor |
|---|---|
| Bucket name | `<TU_BUCKET>` (privado) |
| Acceso público | Bloqueado a nivel de bucket |
| Acceso desde CloudFront | Vía OAC (Origin Access Control) |
| Versionado | Desactivado |
| Lifecycle | No configurado |

**Política de bucket** (snippet):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontServicePrincipal",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::<TU_BUCKET>/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DIST_ID>"
      }
    }
  }]
}
```

### 3.2 Amazon CloudFront

| Parámetro | Valor |
|---|---|
| Origin | S3 bucket vía OAC |
| Alternate domain names (CNAMEs) | `www.jazzenlajungla.com`, `jazzenlajungla.com` |
| Certificado SSL | ACM (us-east-1) cubriendo ambos hostnames |
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Compression | Sí |
| Cache policies | Por defecto |
| Error response | 403/404 → `/index.html` con 200 (long-scroll SPA) |

### 3.3 Amazon API Gateway (HTTP API)

| Parámetro | Valor |
|---|---|
| Tipo | HTTP API (no REST API, más barato) |
| Stage | `$default` con auto-deploy |
| Route | `POST /contacto` → integración Lambda `contactos-jazzenlajungla` |
| CORS | `Access-Control-Allow-Origin: https://www.jazzenlajungla.com, https://jazzenlajungla.com` |
| Auth | Ninguna (público, validación en Lambda) |
| Throttling | Default (10 000 req/s burst, 5 000 sostenido) — más que suficiente |

### 3.4 AWS Lambda — `contactos-jazzenlajungla`

| Parámetro | Valor |
|---|---|
| Runtime | Python 3.14 |
| Arquitectura | x86_64 |
| Memoria | 128 MB |
| Timeout | 10 s |
| Variables de entorno | Ninguna |
| Trigger | API Gateway `POST /contacto` |
| Rol IAM | Permisos sobre la tabla DynamoDB |

**Permisos IAM mínimos**:

```json
{
  "Effect": "Allow",
  "Action": ["dynamodb:PutItem"],
  "Resource": "arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/Contactos-jazzenlajungla"
}
```

### 3.5 AWS Lambda — `reporte-diario-jazzenlajungla`

| Parámetro | Valor |
|---|---|
| Runtime | Python 3.14 |
| Arquitectura | x86_64 |
| Memoria | 256 MB (margen para construir CSV) |
| Timeout | 30 s |
| Variables de entorno | Ninguna |
| Trigger | EventBridge Scheduler |
| Rol IAM | `dynamodb:Scan` + `ses:SendRawEmail` |

### 3.6 Amazon DynamoDB

| Parámetro | Valor |
|---|---|
| Tabla | `Contactos-jazzenlajungla` |
| Partition key | `id` (String, UUID v4) |
| Sort key | — |
| Modo de facturación | On-demand (PAY_PER_REQUEST) |
| Backups | Point-in-time recovery (PITR) recomendado |
| TTL | No |

**Esquema del item**:

| Atributo | Tipo | Origen |
|---|---|---|
| `id` | S | Generado por Lambda (`uuid.uuid4()`) |
| `timestamp` | S | ISO 8601 UTC |
| `fecha_creacion` | S | `YYYY-MM-DD` |
| `name` | S | Formulario |
| `email` | S | Formulario (lowercased) |
| `dob` | S | Formulario (`YYYY-MM-DD`) |
| `edad` | N | Calculada en Lambda |
| `country` | S | ISO 3166 alpha-2 |
| `phone` | S | E.164 con prefijo |
| `edition` | S | `"1"` o `"2"` |
| `accommodation` | S | `"shared"` o `"private"` |
| `background` | S | Texto libre, ≤ 4000 chars |
| `howHeard` | S | Valor del select |
| `consent` | BOOL | Siempre `true` (validado) |
| `estado` | S | `"pendiente"` al crear |
| `ip_origen` | S | De `event.requestContext.http.sourceIp` |
| `user_agent` | S | Del header `user-agent` |

### 3.7 Amazon SES

| Parámetro | Valor |
|---|---|
| Región | `us-east-1` |
| Identidad verificada (email) | `jazzenlajungla@gmail.com` |
| Identidad verificada (dominio) | `jazzenlajungla.com` (en proceso) |
| DKIM | 3 registros CNAME en GoDaddy |
| DMARC | `v=DMARC1; p=none;` |
| SPF | Pendiente al verificar dominio |
| MAIL FROM | `mail.jazzenlajungla.com` (pendiente) |
| Sandbox | Sí (envío solo a verificados; production access pendiente) |

### 3.8 Amazon EventBridge Scheduler

| Parámetro | Valor |
|---|---|
| Nombre | `reporte-diario-jjl` |
| Expression | `cron(0 9 * * ? *)` (09:00 UTC diario) |
| Target | Lambda `reporte-diario-jazzenlajungla` |
| Flexible time window | Off |
| Retry policy | Default |

---

## 4. Flujo de datos · Data flow

### 4.1 Envío del formulario

1. Usuario rellena el formulario en `index.html`.
2. JS construye `payload` y llama `fetch(CONFIG.API_URL, …)`.
3. CloudFront NO interviene (el `API_URL` apunta directo a API Gateway).
4. API Gateway invoca la Lambda con el evento HTTP API v2.
5. Lambda valida cada campo. Si algo falla, devuelve 400 con `{ error: "<mensaje>" }` que el frontend muestra textualmente.
6. Si todo va bien, construye `item` con `uuid.uuid4()` como `id` y hace `table.put_item(Item=item)`.
7. Devuelve 200 con `{ success: true, id: <uuid> }`.
8. Frontend oculta el formulario y muestra mensaje de éxito.

### 4.2 Reporte diario

1. A las 09:00 UTC, EventBridge Scheduler dispara la Lambda.
2. Lambda hace `table.scan()` para leer todas las solicitudes.
3. Construye un CSV en memoria con `csv.DictWriter`.
4. Construye un email multipart MIME (HTML + adjunto CSV) usando `email.mime.*`.
5. Envía con `ses.send_raw_email(RawMessage={'Data': ...})`.
6. Logs en CloudWatch para auditoría.

> **Nota**: actualmente el scan no filtra. En el roadmap está filtrar por `estado = "pendiente"` cuando exista mecanismo de actualización del estado.

---

## 5. Seguridad · Security

- **No hay endpoints sensibles**. El único endpoint público es `POST /contacto` y solo crea registros (no lee, no modifica, no borra).
- **CORS** restringe el origin (`https://www.jazzenlajungla.com` y `https://jazzenlajungla.com`).
- **Validación servidor**: la Lambda re-valida todo lo que el frontend pretende haber validado. No confía en el cliente.
- **DynamoDB**: solo accesible vía rol IAM de las Lambdas. No tiene endpoint público.
- **S3**: bloqueado a tráfico público; solo CloudFront vía OAC.
- **HTTPS forzado** en CloudFront.
- **Sin secretos en el repo**. El único valor "sensible" en el frontend (la URL del API Gateway) es por definición público al estar en el HTML que cualquier visitante puede ver.

**Pendiente**: rate limiting más fino en API Gateway si aparece abuso (actualmente el default es generoso).

---

## 6. Coste estimado · Estimated cost

Con el volumen actual previsto (decenas de solicitudes/mes, 1 reporte/día):

| Servicio | Coste mensual estimado |
|---|---|
| S3 (almacenamiento + requests) | < $0.05 |
| CloudFront (tráfico) | < $0.10 |
| API Gateway HTTP API | < $0.10 |
| Lambda (invocaciones + GB-s) | $0.00 (free tier) |
| DynamoDB (on-demand) | < $0.05 |
| SES (emails) | $0.00 (free tier hasta 62 000/mes desde Lambda) |
| EventBridge Scheduler | $0.00 (free tier) |
| Route 53 / DNS | $0.00 (DNS en GoDaddy) |
| **Total** | **< $1 USD/mes** |

Cuando se salga del sandbox de SES y se verifique el dominio, sigue siendo prácticamente gratis para el volumen esperado.

---

## 7. Decisiones técnicas notables · Notable technical decisions

### 7.1 Vanilla JS sin bundler

Decidido para evitar coste de mantenimiento de dependencias (npm audit, deprecations), reducir tamaño de bundle (no hay React, no hay tree-shaking necesario) y permitir `Ctrl+F5` como flujo de desarrollo. El sitio carga en < 1 segundo en 4G.

### 7.2 HTTP API en lugar de REST API

API Gateway HTTP API es ~70 % más barato y suficiente para nuestro caso de uso (un solo `POST`, sin necesidad de modelos avanzados ni respuestas binarias).

### 7.3 DynamoDB on-demand

Volumen impredecible y bajo. On-demand evita aprovisionar capacidad y pagar por lo no usado. Si el volumen crece de forma sostenida, migrar a provisioned con autoscaling.

### 7.4 Cron en UTC

EventBridge solo trabaja en UTC. `09:00 UTC` equivale a `11:00 CEST` (verano España) o `10:00 CET` (invierno). Para los socios en Costa Rica son las `03:00 CST`. Si se quiere optimizar la hora local, basta con cambiar el cron sin tocar código.

### 7.5 Lambda runtime Python 3.14

Última versión estable en el momento del despliegue. Mejora el cold start frente a 3.11/3.12 (~30 %) y soporta sintaxis moderna.

### 7.6 GoDaddy en lugar de Route 53

Decisión de coste: Route 53 cobra ~$0.50/mes por hosted zone. GoDaddy gestiona el DNS sin coste adicional al precio del dominio. La única funcionalidad perdida es el `ALIAS` en apex, mitigado por SSL forwarding.

---

## 8. Operativa · Operations

### 8.1 Logs

- **Lambdas**: CloudWatch log groups `/aws/lambda/contactos-jazzenlajungla` y `/aws/lambda/reporte-diario-jazzenlajungla`.
- **API Gateway**: logs de acceso opcionales (desactivados por coste; activar si se necesita auditoría detallada).
- **CloudFront**: standard logs desactivados por defecto.

### 8.2 Monitoreo recomendado

- Alarma de CloudWatch sobre `Errors` de la Lambda `contactos-jazzenlajungla` con threshold 1 en 5 minutos. Notifica a SNS → email.
- Alarma sobre `Throttles` de DynamoDB.
- Alarma sobre `SES bounce rate > 5 %`.

### 8.3 Backups

- DynamoDB: activar Point-In-Time Recovery (PITR) — coste despreciable.
- S3: no requiere; los archivos viven en el repo.
- Código: este repositorio Git es la fuente de verdad.

### 8.4 Recuperación ante desastres

Reconstrucción completa en una cuenta AWS vacía: ~30 minutos siguiendo la sección "Initial setup" del README más los snippets de este documento. Sin estado externo crítico fuera de DynamoDB.

---

## 9. Roadmap técnico · Technical roadmap

Ver el roadmap completo en el [README](./README.md#roadmap). Aquí los detalles técnicos de los items más relevantes:

- **Estado de solicitudes editable sin tocar DynamoDB**: la opción preferente es enlaces firmados HMAC en el email del reporte. El email lleva un enlace `https://api.../estado?id=<uuid>&token=<hmac>&status=contactada` por cada solicitud. La Lambda valida `HMAC(secret, id+status+exp)`, muestra una página de confirmación y al click final hace `UpdateItem` con `SET estado = :s`.
- **SES production access**: enviar request en la consola de SES con caso de uso (notificaciones transaccionales a clientes que se han inscrito), volumen estimado (< 100/día) y proceso de manejo de bounces/complaints (suscripción a SNS topic + Lambda que marca emails inválidos).
- **CSV diferencial**: cambiar el `scan` por `query` con GSI `estado-fecha_creacion-index` filtrando `estado = pendiente`. Reduce coste y hace el email procesable.
