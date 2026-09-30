// Servidor local do jogo: serve a pasta ./jogo.
// (Navegadores não carregam módulos JavaScript direto do disco, por isso ele existe.)
//   node servidor.mjs         → modo jogar: abre o navegador (é o que o JOGAR.bat usa)
//   node servidor.mjs --dev   → modo desenvolvimento: recarrega a página sozinho a cada
//                               arquivo salvo em ./jogo e não abre abas novas
import http from "node:http";
import { readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { exec } from "node:child_process";
import { extname, join, normalize } from "node:path";

const root = join(import.meta.dirname, "jogo");
const DEV = process.argv.includes("--dev");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const RELOAD = `<script>new EventSource("/__reload").onmessage=()=>location.reload();</script>`;
const clients = new Set();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (DEV && url.pathname === "/__reload") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(": ok\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  const file = normalize(join(root, url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname)));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    let body = await readFile(file);
    if (DEV && extname(file) === ".html") body = body.toString().replace("</body>", RELOAD + "</body>");
    const headers = { "Content-Type": TYPES[extname(file)] || "application/octet-stream" };
    if (DEV) headers["Cache-Control"] = "no-store";
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

if (DEV) {
  let timer;
  watch(root, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const c of clients) c.write("data: reload\n\n");
    }, 200);
  });
}

let port = 5391;
server.on("error", (err) => {
  if (err.code === "EADDRINUSE" && port < 5410) {
    port++;
    server.listen(port, "127.0.0.1");
  } else throw err;
});
server.on("listening", () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`\n  Hora de Aventura rodando em ${url}${DEV ? "  (modo dev: recarrega sozinho)" : ""}`);
  console.log("  Feche esta janela para desligar o jogo.\n");
  if (DEV) return;
  if (process.platform === "win32") exec(`start "" "${url}"`);
  else if (process.platform === "darwin") exec(`open "${url}"`);
  else exec(`xdg-open "${url}"`);
});
server.listen(port, "127.0.0.1");
