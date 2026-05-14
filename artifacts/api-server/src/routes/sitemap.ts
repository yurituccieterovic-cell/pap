import { Router, type IRouter } from "express";
import { db, nodesTable } from "@workspace/db";

const router: IRouter = Router();

const CANONICAL_BASE = "https://projetoaliancapanoramapap.replit.app";

router.get("/sitemap.xml", async (req, res): Promise<void> => {
  try {
    const nodes = await db.select().from(nodesTable);
    const today = new Date().toISOString().split("T")[0];

    const priorityForDepth = (code: string): string => {
      const d = code.length;
      if (d <= 1) return "1.0";
      if (d === 2) return "0.9";
      if (d === 3) return "0.8";
      if (d === 4) return "0.7";
      return "0.6";
    };

    const urls = nodes
      .map(
        (n) => `  <url>
    <loc>${CANONICAL_BASE}/no/${encodeURIComponent(n.code)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priorityForDepth(n.code)}</priority>
  </url>`
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  <url>
    <loc>${CANONICAL_BASE}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(xml);
  } catch (err) {
    req.log.error(err, "sitemap generation failed");
    res.status(500).send("Erro ao gerar sitemap");
  }
});

export default router;
