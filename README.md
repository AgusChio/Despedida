# Despedida de Caro

Invitación del finde, con el itinerario y un álbum de fotos por momento. Las fotos se ven en la página y, cuando Drive está conectado, también se guardan en una carpeta por cada parte del plan.

## Correrla en esta compu

```bash
npm install
npx convex dev
```

En otra terminal:

```bash
npm run dev
```

Abrí http://localhost:5173. La entrada es con Gmail. Tu cuenta, agus.chio25790@gmail.com, abre el panel para ver a las invitadas y marcar a la novia.

## Entrar con Gmail

Hace falta un cliente de OAuth de tipo **Aplicación web**, distinto del de Drive.

1. En el mismo proyecto de Google Cloud, creá un ID de cliente **Aplicación web**.
2. Orígenes de JavaScript autorizados: `http://localhost:5173`
3. URI de redirección autorizada: `https://neat-boar-633.convex.site/api/auth/callback/google`
4. Cargá las claves:

```bash
npx convex env set AUTH_GOOGLE_ID "el-client-id"
npx convex env set AUTH_GOOGLE_SECRET "el-client-secret"
```

Publicá la pantalla de consentimiento en **En producción** para que las chicas puedan entrar, no solo las usuarias de prueba.

## Conectar Google Drive

Las carpetas las crea el script en tu Drive (Despedida Caro / Tarde de chicas, Escapadita sorpresa, El último cafecito). No hace falta armarlas a mano.

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/) y creá un proyecto.
2. Activá **Google Drive API**.
3. En **Pantalla de consentimiento de OAuth**, tipo **Externo**. No subas un logo. Publicá la app (**En producción**). El permiso que usa esta página es `drive.file`: solo ve las carpetas que ella misma crea, y no pide la verificación de Google. Si la dejás en modo Prueba, el acceso se corta a los 7 días.
4. Creá una credencial **ID de cliente de OAuth**, tipo **Aplicación de escritorio**.
5. Con `npx convex dev` corriendo, en otra terminal:

```bash
npm run drive:conectar
```

Pegá el Client ID y el Client secret. Se abre Google: entrá con la cuenta donde querés las fotos. El script crea las carpetas y guarda las claves en Convex.

## Para que las chicas lo abran del celular

El backend de Convex en la nube ya se puede usar desde cualquier lado. La página hay que publicarla (Vercel, Netlify o Cloudflare) con la variable `VITE_CONVEX_URL` que queda en `.env.local`.

En la misma wifi, también podés probar con:

```bash
npm run dev -- --host
```
