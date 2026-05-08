import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import bcrypt from "bcryptjs";

const router = Router();

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  skipSuccessfulRequests: true,
});

router.post("/auth/login", loginRateLimit, async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const { login, password } = parsed.data;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.login, login))
    .limit(1);

  const passwordValid =
    user && typeof user.passwordHash === "string" && user.passwordHash.length > 0
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
  if (!user || !passwordValid) {
    res.status(401).json({ error: "Login ou senha incorretos" });
    return;
  }

  req.session.userId = user.id;
  req.session.userLogin = user.login;
  req.session.userTier = user.tier;

  res.json({
    id: user.id,
    login: user.login,
    tier: user.tier,
    displayName: user.displayName,
  });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.json({ user: null });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId))
    .limit(1);

  if (!user) {
    req.session.destroy(() => {});
    res.json({ user: null });
    return;
  }

  res.json({
    user: {
      id: user.id,
      login: user.login,
      tier: user.tier,
      displayName: user.displayName,
    },
  });
});

export default router;
