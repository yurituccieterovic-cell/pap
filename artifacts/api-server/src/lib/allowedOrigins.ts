const replitDomains = process.env["REPLIT_DOMAINS"]
  ? process.env["REPLIT_DOMAINS"].split(",").map((d) => `https://${d.trim()}`)
  : [];

export const allowedOrigins = new Set([
  ...replitDomains,
  "http://localhost",
  "http://localhost:80",
  "http://localhost:3000",
  "http://localhost:18434",
]);
