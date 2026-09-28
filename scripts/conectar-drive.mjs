import { execFile, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { writeFile } from "node:fs/promises";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;

const FOLDERS = [
  ["DRIVE_FOLDER_TARDE", "DRIVE_LINK_TARDE", "Tarde de chicas"],
  ["DRIVE_FOLDER_ESCAPADA", "DRIVE_LINK_ESCAPADA", "Escapadita sorpresa"],
  ["DRIVE_FOLDER_CAFE", "DRIVE_LINK_CAFE", "El último cafecito"],
];

function openBrowser(url) {
  if (process.platform === "win32") {
    execFile("rundll32", ["url.dll,FileProtocolHandler", url]);
    return;
  }
  execFile(process.platform === "darwin" ? "open" : "xdg-open", [url]);
}

async function ask(question) {
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

function listenForCode() {
  let settle;
  const codePromise = new Promise((resolve, reject) => {
    settle = { resolve, reject };
  });
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", REDIRECT);
    if (url.pathname !== "/callback") {
      response.writeHead(404);
      response.end();
      return;
    }
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      "<p style='font-family:sans-serif'>Listo. Ya podés volver a la terminal.</p>",
    );
    server.close();
    if (error || !code) settle.reject(new Error(error || "Google no devolvió el código."));
    else settle.resolve(code);
  });
  const ready = new Promise((resolve, reject) => {
    server.on("error", (error) => {
      reject(error);
      settle.reject(error);
    });
    server.listen(PORT, "127.0.0.1", resolve);
  });
  return { ready, code: codePromise };
}

async function tokenFromCode(clientId, clientSecret, code) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "No se pudo canjear el código.");
  }
  return data;
}

async function drive(token, path, options = {}) {
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "Drive rechazó el pedido.");
  }
  return data;
}

async function findOrCreateFolder(token, name, parentId) {
  const clauses = [
    "mimeType='application/vnd.google-apps.folder'",
    `name='${name.replaceAll("'", "\\'")}'`,
    "trashed=false",
  ];
  if (parentId) clauses.push(`'${parentId}' in parents`);
  const query = encodeURIComponent(clauses.join(" and "));
  const found = await drive(
    token,
    `/files?q=${query}&fields=files(id,name)&pageSize=1`,
  );
  if (found.files?.[0]?.id) return found.files[0].id;
  const created = await drive(token, "/files?fields=id", {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  return created.id;
}

const clientId = process.env.GOOGLE_CLIENT_ID || (await ask("Client ID de Google: "));
const clientSecret =
  process.env.GOOGLE_CLIENT_SECRET || (await ask("Client secret de Google: "));
if (!clientId || !clientSecret) {
  console.error("Faltan el client ID y el client secret.");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", REDIRECT);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\nSe va a abrir Google para autorizar la despedida.");
console.log("Entrá con la cuenta de Drive donde querés las fotos.\n");
const pending = listenForCode();
await pending.ready;
openBrowser(authUrl.toString());
const code = await pending.code;
const tokens = await tokenFromCode(clientId, clientSecret, code);

if (!tokens.refresh_token) {
  console.error("Google no entregó un refresh token. Volvé a correr el script.");
  process.exit(1);
}
if (tokens.refresh_token_expires_in) {
  console.warn(
    "\nEste acceso vence en unos días. En Google Cloud, publicá la app (En producción) y volvé a correr este script. No hace falta verificación si el permiso es solo drive.file y no cargaste un logo.",
  );
}

console.log("Creando las carpetas en Drive…");
const rootId = await findOrCreateFolder(tokens.access_token, "Despedida Caro");
const values = {
  GOOGLE_CLIENT_ID: clientId,
  GOOGLE_CLIENT_SECRET: clientSecret,
  GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
};
for (const [idName, linkName, folderName] of FOLDERS) {
  const id = await findOrCreateFolder(tokens.access_token, folderName, rootId);
  values[idName] = id;
  values[linkName] = `https://drive.google.com/drive/folders/${id}`;
  console.log(`  ${folderName}`);
}

const envFile = "drive.env.local";
const body = Object.entries(values)
  .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  .join("\n");
await writeFile(envFile, `${body}\n`, "utf8");

console.log("\nGuardé las claves en drive.env.local (no se sube a git).");
const pushed = spawnSync(
  "npx",
  ["convex", "env", "set", "--force", "--from-file", envFile],
  { stdio: "inherit", shell: true },
);
if (pushed.status !== 0) {
  console.log(
    "\nNo pude cargarlas en Convex. Cuando `npx convex dev` esté andando, corré:",
  );
  console.log("npx convex env set --force --from-file drive.env.local");
} else {
  console.log("\nDrive quedó conectado. Las próximas fotos también entran a las carpetas.");
}
