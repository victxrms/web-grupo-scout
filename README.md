# Web de grupo scout

Plantilla para montar la web de un grupo scout con:

- **Web pública**: inicio, secciones, cómo apuntarse, galería, documentos, Patrullómetro, lugares de acampada, guías y equipo de scouters. Sobria, rápida, se ve bien en el móvil y en modo oscuro.
- **Editor** (`/kraal` → Editar la web): todos los textos, secciones, documentos, fotos, colores, logo, aviso destacado y qué páginas se enseñan. Sin tocar código y sin volver a publicar.
- **Kraal** (zona de scouters, con cuenta de Google):
  - **Asistencia y cuotas**: pasar lista desde el móvil, dinero recogido, quién debe, resumen y exportación a Excel por ronda.
  - **Patrullómetro**: sumar y quitar puntos; crear y renombrar patrullas.
  - **Personas con acceso**: quién entra y quién es administradora.

Funciona con **Firebase** (de Google), y con el plan gratuito sobra para un grupo.

---

## Índice

1. [Lo que necesitas](#1-lo-que-necesitas)
2. [Crear el proyecto de Firebase](#2-crear-el-proyecto-de-firebase)
3. [Descargar y configurar la plantilla](#3-descargar-y-configurar-la-plantilla)
4. [Probarla en tu ordenador](#4-probarla-en-tu-ordenador)
5. [Publicarla en Internet](#5-publicarla-en-internet)
6. [Dominio propio (opcional)](#6-dominio-propio-opcional)
7. [Uso del día a día](#7-uso-del-día-a-día)
8. [Fotos](#8-fotos)
9. [Listado de educandos desde Google Drive (opcional)](#9-listado-de-educandos-desde-google-drive-opcional)
10. [Privacidad](#10-privacidad)
11. [Para quien programe](#11-para-quien-programe)

---

## 1. Lo que necesitas

- Una **cuenta de Google** (será la primera administradora). Sirve una de Gmail.
- Una **cuenta de GitHub** (gratis): <https://github.com/signup>
- **Node.js 20 o más nuevo** en tu ordenador: <https://nodejs.org> (la versión «LTS»).
- **Git** (en Mac ya viene; en Windows: <https://git-scm.com>).

Todos los comandos de esta guía se escriben en la **Terminal** (Mac) o **PowerShell** (Windows), dentro de la carpeta del proyecto.

## 2. Crear el proyecto de Firebase

1. Entra en <https://console.firebase.google.com> → **Crear un proyecto**. Ponle un nombre (por ejemplo `gs-mi-grupo`). Google Analytics no hace falta.
2. **Base de datos**: menú *Compilación → Firestore Database → Crear base de datos*.
   - Ubicación: una de Europa (por ejemplo `eur3` o `europe-southwest1`). **No se puede cambiar después.**
   - Modo: **producción**.
3. **Inicio de sesión**: *Compilación → Authentication → Comenzar → Google →* actívalo, elige el correo de asistencia y guarda.
4. **App web**: ⚙ *Configuración del proyecto → General →* abajo, en «Tus apps», pulsa el icono **`</>`**. Ponle un nombre, **no** marques Hosting todavía y pulsa *Registrar app*. Deja esa pantalla abierta: en el paso siguiente copiarás el bloque `const firebaseConfig = { … }`.

## 3. Descargar y configurar la plantilla

1. En GitHub, en la página de esta plantilla, pulsa **Use this template → Create a new repository**. Ponle nombre (por ejemplo `web-mi-grupo`) y créalo.
2. Descárgalo a tu ordenador (cambia la dirección por la de tu repositorio):

   ```bash
   git clone https://github.com/TU-USUARIO/web-mi-grupo.git
   cd web-mi-grupo
   npm install
   ```

3. Ejecuta el asistente y responde a lo que pregunta:

   ```bash
   npm run configurar
   ```

   Te pedirá que pegues el bloque `firebaseConfig` del paso 2.4, el correo de la **primera administradora** y la dirección de la web (si aún no tienes dominio, pulsa Intro).

4. Publica las **reglas de seguridad** (lo que protege los datos):

   ```bash
   npx firebase-tools login
   npm run reglas
   ```

   > ⚠️ Sin este paso nadie puede guardar nada, ni siquiera la administradora. Cada vez que cambies `firestore.rules` (o vuelvas a ejecutar `npm run configurar` con otra administradora), repítelo.

## 4. Probarla en tu ordenador

```bash
npm run dev
```

Abre <http://localhost:5173>. Verás la web con textos de ejemplo.

1. Ve a <http://localhost:5173/kraal> y entra con la cuenta de la administradora.
2. **Editar la web**: cambia el nombre del grupo, el color, las secciones… y pulsa **Publicar**.
3. **Personas con acceso**: añade a las demás scouters.
4. **Patrullómetro**: crea las patrullas.
5. **Asistencia → Ajustes**: sube el Excel con el listado de educandos y pon la cuota de cada sección.

## 5. Publicarla en Internet

1. Conecta GitHub con Firebase Hosting:

   ```bash
   npx firebase-tools init hosting:github
   ```

   - Repositorio: `TU-USUARIO/web-mi-grupo`.
   - «Set up the workflow to run a build script…?» → **No**.
   - «Set up automatic deployment… when a PR is merged?» → **No**.
   - Si pregunta si sobrescribir archivos, responde **No**.

   Esto crea en GitHub el secreto `FIREBASE_SERVICE_ACCOUNT_…` que usa la plantilla para publicar. Si ha creado archivos `firebase-hosting-*.yml` en `.github/workflows`, bórralos: la plantilla ya trae los suyos (`publicar.yml` y `vista-previa.yml`).

2. En GitHub: tu repositorio → **Settings → Secrets and variables → Actions → New repository secret**. Crea un secreto por cada línea de tu archivo `.env` que tenga valor (nombre = lo de antes del `=`, valor = lo de después). El asistente te dio la lista.
3. Sube los cambios:

   ```bash
   git add -A
   git commit -m "Configuración del grupo"
   git push
   ```

4. En GitHub, pestaña **Actions**, verás «Publicar la web». Cuando salga en verde, la web estará en `https://TU-PROYECTO.web.app`.

Desde ahora:

- Lo que cambies en el **editor** se ve al momento.
- Lo que cambies en el **código** se publica solo al hacer `git push` a `main`.
- Cada lunes la web se vuelve a publicar sola para que Google y las redes sociales vean el contenido actualizado (también puedes lanzarlo a mano: *Actions → Publicar la web → Run workflow*).

## 6. Dominio propio (opcional)

1. Firebase → *Hosting → Agregar dominio personalizado* y sigue los pasos (hay que añadir unos registros DNS donde compraste el dominio).
2. Firebase → *Authentication → Configuración → Dominios autorizados* → añade tu dominio.
3. Vuelve a ejecutar `npm run configurar`, pon la nueva dirección (`https://migrupo.org`) y responde **s** a «¿Iniciar sesión desde migrupo.org?». Así el inicio de sesión funciona bien en iPhone (Safari).
4. En <https://console.cloud.google.com> (mismo proyecto) → *APIs y servicios → Credenciales →* el «ID de cliente de OAuth» de tipo Web → añade:
   - Orígenes autorizados de JavaScript: `https://migrupo.org`
   - URI de redireccionamiento autorizados: `https://migrupo.org/__/auth/handler`
5. Actualiza en GitHub los secretos `VITE_URL_WEB` y `VITE_FIREBASE_AUTH_DOMAIN` y vuelve a publicar.

## 7. Uso del día a día

### Permisos

| | Scouter | Administradora |
|---|:---:|:---:|
| Pasar lista y apuntar dinero | ✓ | ✓ |
| Ver el resumen de cuotas | ✓ | ✓ |
| Sumar y quitar puntos del Patrullómetro | ✓ | ✓ |
| Editar la web | | ✓ |
| Personas con acceso | | ✓ |
| Listado de educandos, cuotas y exportar rondas | | ✓ |
| Crear, renombrar y borrar patrullas | | ✓ |

Si el grupo tiene Google Workspace (correos `@migrupo.org`), en **Personas con acceso → Dominio del grupo** puedes dar acceso de scouter a todas esas cuentas de una vez.

### Asistencia y cuotas

- **Listado** (*Asistencia → Ajustes*): un Excel (`.xlsx`) o `.csv` con las columnas **Nombre** y **Sección**, y opcionalmente **Apellidos** (o **Iniciales**) e **ID**. Se lee en tu dispositivo y solo se guardan esas columnas. Cuando cambie, vuelve a subirlo: la web enseña qué altas, bajas y cambios hay antes de aplicarlos.
- **Cuotas**: en *Ajustes → Cuotas por sección*, el importe y si es **por reunión** o **por trimestre** (un solo pago por trimestre: septiembre–diciembre, enero–marzo, abril–agosto).
- **Pasar lista**: elige sección y fecha, marca quién ha venido y cuánto dinero ha traído cada persona y pulsa *Guardar*. Si otra persona ha guardado la misma reunión mientras la tenías abierta, la web te avisa.
- **Rondas**: cada ronda va del 1 de septiembre al 31 de agosto. El 1 de septiembre empieza sola la nueva (a cero). Las anteriores se descargan en *Ajustes → Rondas y exportación*.

### Textos con formato

En los textos largos del editor:

- Una línea en blanco separa párrafos.
- `**negrita**` se ve en **negrita**.
- `[texto del enlace](https://…)` crea un enlace.

### Copia de seguridad del contenido

*Editar la web → Descargar copia* guarda todo el contenido en un archivo. Para volver a ponerlo como contenido de partida, sustituye `src/contenido/inicial.json` por ese archivo.

## 8. Fotos

Guardar archivos en Firebase obliga a activar su plan de pago, así que las fotos se enlazan:

- **Opción sencilla**: sube las fotos a la carpeta `public/fotos` del repositorio. En GitHub: entra en la carpeta → *Add file → Upload files*. Luego, en el editor, escribe `/fotos/nombre-de-la-foto.jpg`. Reduce antes las fotos a unos 1600 px de ancho para que la web cargue rápido.
- **Logo**: sustituye `public/logo.svg` (o sube `public/logo.png` y pon `/logo.png` en *Editar la web → Apariencia*).
- También sirve cualquier enlace `https://` directo a una imagen.

## 9. Listado de educandos desde Google Drive (opcional)

Para que *Ajustes* lea el Excel directamente de Google Drive (en vez de subirlo desde el dispositivo):

1. <https://console.cloud.google.com> (mismo proyecto) → *APIs y servicios → Biblioteca →* **Google Drive API → Habilitar**.
2. *Google Auth Platform → Acceso a los datos → Agregar o quitar permisos* → añade `…/auth/drive.readonly`.
3. *Público*: deja la app en modo **Prueba** y añade como usuarias de prueba a las administradoras que vayan a usarlo (Google exige verificar la app para publicarla con este permiso).
4. En *Asistencia → Ajustes*, pega el enlace del Excel y pulsa *Leer desde Google Drive*.

Subir el archivo desde el dispositivo funciona siempre, sin nada de esto.

## 10. Privacidad

- Los datos de educandos y pagos **solo** los ven personas con acceso al Kraal: lo comprueban los servidores de Google (`firestore.rules`), no solo la página.
- Solo se guarda nombre, apellidos o iniciales, sección y lo que se apunta en cada reunión. No guardes datos de salud ni teléfonos aquí.
- *Cerrar sesión* borra del dispositivo la copia local de los datos.
- Para borrar del todo a un educando (derecho de supresión), hazlo desde Firebase → Firestore (`educandos` y sus `registrosAsistencia`).
- Las páginas del Kraal no aparecen en buscadores.

## 11. Para quien programe

- React + TypeScript + Vite. Sin framework de CSS: todo está en `src/estilos.css` (variables arriba del todo).
- **Contenido**: `src/lib/contenido.ts` (tipos y lectura) y `src/contenido/inicial.json` (contenido de partida). Se guarda entero en `web/contenido` (campo `datos`, JSON) y las páginas públicas lo leen con la API REST de Firestore, sin cargar la librería de Firebase.
- **Prerenderizado**: `scripts/prerender.mjs` genera el HTML de cada página con el contenido publicado (para buscadores y redes).
- **Páginas**: `src/lib/paginas.ts` (menú, títulos, SEO) + `src/pages/` + rutas en `src/App.tsx` y `src/entry-server.tsx`.
- **Kraal**: `src/kraal/`. Permisos en `src/lib/roles.ts` y, de verdad, en `firestore.rules`.
- **Pruebas**: `npm test`. Comprueba tipos con `npx tsc --noEmit`.

| Colección | Qué guarda | Quién la lee / escribe |
|---|---|---|
| `web/contenido` | Todo el contenido de la web | Todo el mundo / administradoras |
| `web/acceso` | Dominio del grupo | Todo el mundo / administradoras |
| `miembros/{correo}` | Personas con acceso y su rol | Administradoras (cada cual la suya) |
| `patrullas`, `historial` | Patrullómetro | Todo el mundo / scouters |
| `educandos`, `reuniones`, `registrosAsistencia`, `ajustesAsistencia` | Asistencia y cuotas | Scouters (ajustes y listado: administradoras) |
