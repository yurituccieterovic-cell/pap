import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, nodeProgressTable, achievementsTable, nodesTable } from "@workspace/db";
import { OpenNodeParams, ReadNodeParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function getProgressData() {
  const allProgress = await db.select().from(nodeProgressTable);
  const allAchievements = await db.select().from(achievementsTable);
  const allNodes = await db.select().from(nodesTable);

  const openedNodes = allProgress.filter((p) => p.opened).map((p) => p.nodeCode);
  const readNodes = allProgress.filter((p) => p.read).map((p) => p.nodeCode);
  const totalNodes = allNodes.length;
  const explorationPercent = totalNodes > 0 ? Math.round((openedNodes.length / totalNodes) * 100) : 0;

  return {
    openedNodes,
    readNodes,
    achievements: allAchievements.map((a) => ({
      id: a.id,
      code: a.code,
      title: a.title,
      description: a.description,
      type: a.type as "explored" | "read" | "exercise" | "approved",
      nodeCode: a.nodeCode ?? null,
      earnedAt: a.earnedAt ? a.earnedAt.toISOString() : null,
      earned: a.earned,
    })),
    totalNodes,
    explorationPercent,
  };
}

router.get("/progress", async (_req, res): Promise<void> => {
  const progress = await getProgressData();
  res.json(progress);
});

router.get("/summary", async (_req, res): Promise<void> => {
  const allProgress = await db.select().from(nodeProgressTable);
  const allAchievements = await db.select().from(achievementsTable);
  const allNodes = await db.select().from(nodesTable);

  const openedNodes = allProgress.filter((p) => p.opened).map((p) => p.nodeCode);
  const readNodes = allProgress.filter((p) => p.read).map((p) => p.nodeCode);
  const earnedAchievements = allAchievements.filter((a) => a.earned);
  const totalNodes = allNodes.length;
  const explorationPercent = totalNodes > 0 ? Math.round((openedNodes.length / totalNodes) * 100) : 0;

  const childCounts = allNodes.reduce<Record<string, number>>((acc, n) => {
    if (n.parentCode) {
      acc[n.parentCode] = (acc[n.parentCode] ?? 0) + 1;
    }
    return acc;
  }, {});

  const recentProgress = allProgress
    .filter((p) => p.opened && p.openedAt)
    .sort((a, b) => (b.openedAt?.getTime() ?? 0) - (a.openedAt?.getTime() ?? 0))
    .slice(0, 5);

  const recentlyOpened = recentProgress
    .map((p) => allNodes.find((n) => n.code === p.nodeCode))
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
    achievementsEarned: earnedAchievements.length,
    totalAchievements: allAchievements.length,
    totalNodes,
    explorationPercent,
    recentlyOpened,
  });
});

router.post("/progress/open/:code", async (req, res): Promise<void> => {
  const params = OpenNodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { code } = params.data;

  const existing = await db.select().from(nodeProgressTable).where(eq(nodeProgressTable.nodeCode, code));

  if (existing.length === 0) {
    await db.insert(nodeProgressTable).values({
      nodeCode: code,
      opened: true,
      openedAt: new Date(),
    });
  } else if (!existing[0].opened) {
    await db.update(nodeProgressTable)
      .set({ opened: true, openedAt: new Date() })
      .where(eq(nodeProgressTable.nodeCode, code));
  }

  // Award "explored" achievement for this node
  const achCode = `explored_${code}`;
  const existingAch = await db.select().from(achievementsTable).where(eq(achievementsTable.code, achCode));
  if (existingAch.length > 0 && !existingAch[0].earned) {
    await db.update(achievementsTable)
      .set({ earned: true, earnedAt: new Date() })
      .where(eq(achievementsTable.code, achCode));
  }

  const progress = await getProgressData();
  res.json(progress);
});

router.post("/progress/read/:code", async (req, res): Promise<void> => {
  const params = ReadNodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { code } = params.data;

  const existing = await db.select().from(nodeProgressTable).where(eq(nodeProgressTable.nodeCode, code));

  if (existing.length === 0) {
    await db.insert(nodeProgressTable).values({
      nodeCode: code,
      opened: true,
      read: true,
      openedAt: new Date(),
      readAt: new Date(),
    });
  } else {
    await db.update(nodeProgressTable)
      .set({ read: true, readAt: new Date() })
      .where(eq(nodeProgressTable.nodeCode, code));
  }

  // Award "read" achievement for this node
  const achCode = `read_${code}`;
  const existingAch = await db.select().from(achievementsTable).where(eq(achievementsTable.code, achCode));
  if (existingAch.length > 0 && !existingAch[0].earned) {
    await db.update(achievementsTable)
      .set({ earned: true, earnedAt: new Date() })
      .where(eq(achievementsTable.code, achCode));
  }

  const progress = await getProgressData();
  res.json(progress);
});

router.get("/achievements", async (_req, res): Promise<void> => {
  const all = await db.select().from(achievementsTable);
  res.json(all.map((a) => ({
    id: a.id,
    code: a.code,
    title: a.title,
    description: a.description,
    type: a.type,
    nodeCode: a.nodeCode ?? null,
    earnedAt: a.earnedAt ? a.earnedAt.toISOString() : null,
    earned: a.earned,
  })));
});

router.get("/progress/daily", async (_req, res): Promise<void> => {
  const allProgress = await db.select().from(nodeProgressTable);

  const countsByDate: Record<string, number> = {};

  for (const p of allProgress) {
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
