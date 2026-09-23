import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { renderizarShell, origemDoRequest } from "./seo/ssr";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Assets com hash no nome podem ficar em cache longo; o resto, curto.
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), { maxAge: "365d", immutable: true, index: false }),
  );
  // `index: false`: a raiz "/" não pode sair do static — precisa passar pelo SEO por rota.
  // `redirect: false`: a pasta public/provador (modelo do MediaPipe) tem o mesmo
  // nome da rota /provador — sem isto o static respondia 301 para "/provador/".
  app.use(express.static(distPath, { index: false, redirect: false, maxAge: "1h" }));

  const template = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");

  // Toda rota de página: HTML com SEO/GEO da rota e status real (404 quando não existe).
  app.use("/{*path}", async (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "nao_encontrado" });
    const { html, status } = await renderizarShell(req.originalUrl, template, origemDoRequest(req));
    res.status(status).set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }).end(html);
  });
}
