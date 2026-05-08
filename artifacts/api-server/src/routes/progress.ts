import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, nodeProgressTable, achievementsTable, nodesTable } from "@workspace/db";
import { OpenNodeParams, ReadNodeParams } from "@workspace/api-zod";
import { canAccess, isInAllowedSubtree } from "../lib/canAccess";
import type { Request, Response } from "express";

const router: IRouter = Router();

function getAuthUserId(req: Request, res: Response): number | null {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Autenticação necessária" });
    return null;
  }
  return userId;
}

async function getProgressData(userId: number, tier: number) {
  const userProgress = await db.select().from(nodeProgressTable).where(eq(nodeProgressTable.userId, userId));
  const userAchievements = await db.select().from(achievementsTable).where(eq(achievementsTable.userId, userId));
  const allNodes = await db.select().from(nodesTable);

  const nodeMap = new Map(allNodes.map((n) => [n.code, n]));
  const accessibleNodes = allNodes.filter(
    (n) => canAccess(n.code, tier) && isInAllowedSubtree(n.code, nodeMap, tier),
  );

  const accessibleCodes = new Set(accessibleNodes.map((n) => n.code));

  const openedNodes = userProgress
    .filter((p) => p.opened && accessibleCodes.has(p.nodeCode))
    .map((p) => p.nodeCode);
  const readNodes = userProgress
    .filter((p) => p.read && accessibleCodes.has(p.nodeCode))
    .map((p) => p.nodeCode);
  const totalNodes = accessibleNodes.length;
  const explorationPercent = totalNodes > 0 ? Math.round((openedNodes.length / totalNodes) * 100) : 0;

  const earnedMap = new Map(userAchievements.map((a) => [a.code, a]));

  const achievements = accessibleNodes.flatMap((node) => {
    const exploredCode = `explored_${node.code}`;
    const readCode = `read_${node.code}`;
    const exploredAch = earnedMap.get(exploredCode);
    const readAch = earnedMap.get(readCode);
    return [
      {
        id: exploredAch?.id ?? 0,
        code: exploredCode,
        title: `Explorador: ${node.title}`,
        description: `Explorou o tópico ${node.title}`,
        type: "explored" as const,
        nodeCode: node.code,
        earnedAt: exploredAch?.earnedAt ? exploredAch.earnedAt.toISOString() : null,
        earned: exploredAch?.earned ?? false,
      },
      {
        id: readAch?.id ?? 0,
        code: readCode,
        title: `Leitor: ${node.title}`,
        description: `Leu o conteúdo de ${node.title}`,
        type: "read" as const,
        nodeCode: node.code,
        earnedAt: readAch?.earnedAt ? readAch.earnedAt.toISOString() : null,
        earned: readAch?.earned ?? false,
      },
    ];
  });

  return { openedNodes, readNodes, achievements, totalNodes, explorationPercent };
}

router.get("/progress", async (req, res): Promise<void> => {
  const userId = getAuthUserId(req, res);
  if (!userId) return;
  const tier = req.session.userTier ?? 0;
  const progress = await getProgressData(userId, tier);
  res.json(progress);
});

router.get("/summary", async (req, res): Promise<void> => {
  const userId = getAuthUserId(req, res);
  if (!userId) return;

  const tier = req.session.userTier ?? 0;

  const userProgress = await db.select().from(nodeProgressTable).where(eq(nodeProgressTable.userId, userId));
  const userAchievements = await db.select().from(achievementsTable).where(eq(achievementsTable.userId, userId));
  const allNodes = await db.select().from(nodesTable);

  const nodeMap = new Map(allNodes.map((n) => [n.code, n]));
  const accessibleNodes = allNodes.filter(
    (n) => canAccess(n.code, tier) && isInAllowedSubtree(n.code, nodeMap, tier),
  );

  const accessibleCodes = new Set(accessibleNodes.map((n) => n.code));

  const openedNodes = userProgress
    .filter((p) => p.opened && accessibleCodes.has(p.nodeCode))
    .map((p) => p.nodeCode);
  const readNodes = userProgress
    .filter((p) => p.read && accessibleCodes.has(p.nodeCode))
    .map((p) => p.nodeCode);
  const totalNodes = accessibleNodes.length;
  const explorationPercent = totalNodes > 0 ? Math.round((openedNodes.length / totalNodes) * 100) : 0;

  const totalAchievements = accessibleNodes.length * 2;
  const earnedAchievements = userAchievements.filter((a) => a.earned).length;

  const childCounts = allNodes.reduce<Record<string, number>>((acc, n) => {
    if (n.parentCode && accessibleCodes.has(n.code)) {
      acc[n.parentCode] = (acc[n.parentCode] ?? 0) + 1;
    }
    return acc;
  }, {});

  const recentProgress = userProgress
    .filter((p) => p.opened && p.openedAt)
    .sort((a, b) => (b.openedAt?.getTime() ?? 0) - (a.openedAt?.getTime() ?? 0))
    .slice(0, 5);

  const recentlyOpened = recentProgress
    .map((p) => accessibleNodes.find((n) => n.code === p.nodeCode))
    .filter(Boolean)
    .map((n) => ({
      code: n!.code,
      title: n!.title,
      parentCode: n!.parentCode ?? null,
      childCount: childCounts[n!.code] ?? 0,
      level: n!.level,
    }));

  res.json({
    nodesExplored: openedNodes.length,
    nodesRead: readNodes.length,
    achievementsEarned: earnedAchievements,
    totalAchievements,
    totalNodes,
    explorationPercent,
    recentlyOpened,
  });
});

router.post("/progress/open/:code", async (req, res): Promise<void> => {
  const userId = getAuthUserId(req, res);
  if (!userId) return;

  const params = OpenNodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { code } = params.data;

  const tier = req.session.userTier ?? 0;

  const allNodes = await db.select().from(nodesTable);
  const nodeMap = new Map(allNodes.map((n) => [n.code, n]));
  const node = nodeMap.get(code);

  if (!node) {
    res.status(404).json({ error: "Nó não encontrado" });
    return;
  }

  if (!canAccess(code, tier) || !isInAllowedSubtree(code, nodeMap, tier)) {
    res.status(403).json({ error: "Acesso negado para o seu nível de conta" });
    return;
  }

  const [existing] = await db.select().from(nodeProgressTable)
    .where(and(eq(nodeProgressTable.userId, userId), eq(nodeProgressTable.nodeCode, code)));

  if (!existing) {
    await db.insert(nodeProgressTable).values({ userId, nodeCode: code, opened: true, openedAt: new Date() });
  } else if (!existing.opened) {
    await db.update(nodeProgressTable)
      .set({ opened: true, openedAt: new Date() })
      .where(and(eq(nodeProgressTable.userId, userId), eq(nodeProgressTable.nodeCode, code)));
  }

  const achCode = `explored_${code}`;
  const [existingAch] = await db.select().from(achievementsTable)
    .where(and(eq(achievementsTable.userId, userId), eq(achievementsTable.code, achCode)));
  if (!existingAch) {
    if (node) {
      await db.insert(achievementsTable).values({
        userId,
        code: achCode,
        title: `Explorador: ${node.title}`,
        description: `Explorou o tópico ${node.title}`,
        type: "explored",
        nodeCode: code,
        earned: true,
        earnedAt: new Date(),
      });
    }
  } else if (!existingAch.earned) {
    await db.update(achievementsTable)
      .set({ earned: true, earnedAt: new Date() })
      .where(and(eq(achievementsTable.userId, userId), eq(achievementsTable.code, achCode)));
  }

  const progress = await getProgressData(userId, tier);
  res.json(progress);
});

router.post("/progress/read/:code", async (req, res): Promise<void> => {
  const userId = getAuthUserId(req, res);
  if (!userId) return;

  const params = ReadNodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { code } = params.data;

  const tier = req.session.userTier ?? 0;

  const allNodes = await db.select().from(nodesTable);
  const nodeMap = new Map(allNodes.map((n) => [n.code, n]));
  const node = nodeMap.get(code);

  if (!node) {
    res.status(404).json({ error: "Nó não encontrado" });
    return;
  }

  if (!canAccess(code, tier) || !isInAllowedSubtree(code, nodeMap, tier)) {
    res.status(403).json({ error: "Acesso negado para o seu nível de conta" });
    return;
  }

  const [existing] = await db.select().from(nodeProgressTable)
    .where(and(eq(nodeProgressTable.userId, userId), eq(nodeProgressTable.nodeCode, code)));

  if (!existing) {
    await db.insert(nodeProgressTable).values({
      userId,
      nodeCode: code,
      opened: true,
      read: true,
      openedAt: new Date(),
      readAt: new Date(),
    });
  } else {
    await db.update(nodeProgressTable)
      .set({ read: true, readAt: new Date() })
      .where(and(eq(nodeProgressTable.userId, userId), eq(nodeProgressTable.nodeCode, code)));
  }

  const achCode = `read_${code}`;
  const [existingAch] = await db.select().from(achievementsTable)
    .where(and(eq(achievementsTable.userId, userId), eq(achievementsTable.code, achCode)));
  if (!existingAch) {
    if (node) {
      await db.insert(achievementsTable).values({
        userId,
        code: achCode,
        title: `Leitor: ${node.title}`,
        description: `Leu o conteúdo de ${node.title}`,
        type: "read",
        nodeCode: code,
        earned: true,
        earnedAt: new Date(),
      });
    }
  } else if (!existingAch.earned) {
    await db.update(achievementsTable)
      .set({ earned: true, earnedAt: new Date() })
      .where(and(eq(achievementsTable.userId, userId), eq(achievementsTable.code, achCode)));
  }

  const progress = await getProgressData(userId, tier);
  res.json(progress);
});

router.get("/achievements", async (req, res): Promise<void> => {
  const userId = getAuthUserId(req, res);
  if (!userId) return;

  const tier = req.session.userTier ?? 0;

  const userAchievements = await db.select().from(achievementsTable).where(eq(achievementsTable.userId, userId));
  const allNodes = await db.select().from(nodesTable);

  const nodeMap = new Map(allNodes.map((n) => [n.code, n]));
  const accessibleNodes = allNodes.filter(
    (n) => canAccess(n.code, tier) && isInAllowedSubtree(n.code, nodeMap, tier),
  );

  const earnedMap = new Map(userAchievements.map((a) => [a.code, a]));

  const achievements = accessibleNodes.flatMap((node) => {
    const exploredCode = `explored_${node.code}`;
    const readCode = `read_${node.code}`;
    const exploredAch = earnedMap.get(exploredCode);
    const readAch = earnedMap.get(readCode);
    return [
      {
        id: exploredAch?.id ?? 0,
        code: exploredCode,
        title: `Explorador: ${node.title}`,
        description: `Explorou o tópico ${node.title}`,
        type: "explored" as const,
        nodeCode: node.code,
        earnedAt: exploredAch?.earnedAt ? exploredAch.earnedAt.toISOString() : null,
        earned: exploredAch?.earned ?? false,
      },
      {
        id: readAch?.id ?? 0,
        code: readCode,
        title: `Leitor: ${node.title}`,
        description: `Leu o conteúdo de ${node.title}`,
        type: "read" as const,
        nodeCode: node.code,
        earnedAt: readAch?.earnedAt ? readAch.earnedAt.toISOString() : null,
        earned: readAch?.earned ?? false,
      },
    ];
  });

  res.json(achievements);
});

router.get("/progress/daily", async (req, res): Promise<void> => {
  const userId = getAuthUserId(req, res);
  if (!userId) return;

  const userProgress = await db.select().from(nodeProgressTable).where(eq(nodeProgressTable.userId, userId));

  const countsByDate: Record<string, number> = {};

  for (const p of userProgress) {
    if (p.openedAt) {
      const date = p.openedAt.toISOString().slice(0, 10);
      countsByDate[date] = (countsByDate[date] ?? 0) + 1;
    }
    if (p.readAt) {
      const date = p.readAt.toISOString().slice(0, 10);
      countsByDate[date] = (countsByDate[date] ?? 0) + 1;
    }
  }

  const result = Object.entries(countsByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json(result);
});

export default router;
