import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { allowedOrigins } from "./lib/allowedOrigins";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) throw new Error("SESSION_SECRET is required");

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);

if (process.env["NODE_ENV"] === "production") {
  // Use import.meta.url so the path is correct regardless of process.cwd()
  // Bundle lives at artifacts/api-server/dist/index.mjs
  // PAP build output lives at artifacts/pap/dist/public/
  const bundleDir = path.dirname(fileURLToPath(import.meta.url));
  const staticDir = path.resolve(bundleDir, "../../pap/dist/public");
  logger.info({ staticDir }, "production: serving static files");
  app.use(express.static(staticDir));
  app.get("/*splat", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"), (err) => {
      if (err) {
        logger.error({ err, staticDir }, "production: failed to send index.html");
        res.status(500).send("Erro ao carregar a aplicação");
      }
    });
  });
}

export default app;
