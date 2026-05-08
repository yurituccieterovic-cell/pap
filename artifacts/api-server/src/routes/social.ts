import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  friendshipsTable,
  friendMessagesTable,
  socialNotesTable,
  exerciseAttemptsTable,
} from "@workspace/db";
import { eq, and, or, desc, inArray } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

function generateCode(login: string): string {
  const base = login.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6).padEnd(4, "x");
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  return base + suffix;
}

async function calculateScore(userId: number): Promise<number> {
  const attempts = await db
    .select({ nodeCode: exerciseAttemptsTable.nodeCode, correct: exerciseAttemptsTable.correct })
    .from(exerciseAttemptsTable)
    .where(eq(exerciseAttemptsTable.userId, userId));
  return attempts.reduce((sum, a) => sum + (a.correct === 1 ? a.nodeCode.length * 10 : 0), 0);
}

async function ensureCode(userId: number): Promise<string> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user?.userCode) return user.userCode;

  let code = generateCode(user?.login ?? "user");
  for (let i = 0; i < 10; i++) {
    const [ex] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.userCode, code))
      .limit(1);
    if (!ex) break;
    code = generateCode(user?.login ?? "user");
  }
  await db.update(usersTable).set({ userCode: code }).where(eq(usersTable.id, userId));
  return code;
}

// GET /social/me
router.get("/social/me", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const code = await ensureCode(userId);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const score = await calculateScore(userId);
  const fRows = await db
    .select({ id: friendshipsTable.id })
    .from(friendshipsTable)
    .where(and(eq(friendshipsTable.userId, userId), eq(friendshipsTable.status, "accepted")));
  res.json({
    id: user.id,
    login: user.login,
    displayName: user.displayName,
    tier: user.tier,
    userCode: code,
    score,
    friendsCount: fRows.length,
  });
});

// PATCH /social/me
router.patch("/social/me", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { displayName, userCode } = req.body as { displayName?: string; userCode?: string };
  const updates: Partial<{ displayName: string | null; userCode: string }> = {};

  if (displayName !== undefined) {
    updates.displayName = displayName.trim().slice(0, 30) || null;
  }
  if (userCode !== undefined) {
    const clean = userCode.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
    if (clean.length < 4) {
      res.status(400).json({ error: "Mínimo 4 caracteres" });
      return;
    }
    const [ex] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.userCode, clean))
      .limit(1);
    if (ex && ex.id !== userId) {
      res.status(409).json({ error: "Código já em uso" });
      return;
    }
    updates.userCode = clean;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
  }
  res.json({ ok: true });
});

// GET /social/friends
router.get("/social/friends", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const rows = await db
    .select({ friendId: friendshipsTable.friendId })
    .from(friendshipsTable)
    .where(and(eq(friendshipsTable.userId, userId), eq(friendshipsTable.status, "accepted")));
  if (rows.length === 0) {
    res.json([]);
    return;
  }
  const ids = rows.map((r) => r.friendId);
  const friends = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, tier: usersTable.tier, userCode: usersTable.userCode })
    .from(usersTable)
    .where(inArray(usersTable.id, ids));
  const result = await Promise.all(
    friends.map(async (f) => ({ ...f, score: await calculateScore(f.id) }))
  );
  res.json(result);
});

// GET /social/friend-requests — incoming pending requests for the current user
router.get("/social/friend-requests", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const rows = await db
    .select({ requesterId: friendshipsTable.userId })
    .from(friendshipsTable)
    .where(and(eq(friendshipsTable.friendId, userId), eq(friendshipsTable.status, "pending")));
  if (rows.length === 0) {
    res.json([]);
    return;
  }
  const ids = rows.map((r) => r.requesterId);
  const requesters = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, tier: usersTable.tier, userCode: usersTable.userCode })
    .from(usersTable)
    .where(inArray(usersTable.id, ids));
  res.json(requesters);
});

// POST /social/friends — send a friend request (pending, no reverse row)
router.post("/social/friends", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { userCode } = req.body as { userCode?: string };
  if (!userCode?.trim()) {
    res.status(400).json({ error: "Código obrigatório" });
    return;
  }
  const [friend] = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, tier: usersTable.tier, userCode: usersTable.userCode })
    .from(usersTable)
    .where(eq(usersTable.userCode, userCode.trim().toLowerCase()))
    .limit(1);
  if (!friend) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  if (friend.id === userId) {
    res.status(400).json({ error: "Você não pode adicionar a si mesmo" });
    return;
  }
  // Check if already accepted friends (either direction)
  const [alreadyFriend] = await db
    .select({ id: friendshipsTable.id })
    .from(friendshipsTable)
    .where(
      and(
        or(
          and(eq(friendshipsTable.userId, userId), eq(friendshipsTable.friendId, friend.id)),
          and(eq(friendshipsTable.userId, friend.id), eq(friendshipsTable.friendId, userId)),
        ),
        eq(friendshipsTable.status, "accepted"),
      )
    )
    .limit(1);
  if (alreadyFriend) {
    res.status(409).json({ error: "Já são amigos" });
    return;
  }
  // Check if a pending request already exists (either direction)
  const [pendingRow] = await db
    .select({ id: friendshipsTable.id, userId: friendshipsTable.userId })
    .from(friendshipsTable)
    .where(
      and(
        or(
          and(eq(friendshipsTable.userId, userId), eq(friendshipsTable.friendId, friend.id)),
          and(eq(friendshipsTable.userId, friend.id), eq(friendshipsTable.friendId, userId)),
        ),
        eq(friendshipsTable.status, "pending"),
      )
    )
    .limit(1);
  if (pendingRow) {
    if (pendingRow.userId === friend.id) {
      // They already sent us a request — auto-accept it atomically
      await db.transaction(async (tx) => {
        await tx
          .update(friendshipsTable)
          .set({ status: "accepted" })
          .where(eq(friendshipsTable.id, pendingRow.id));
        await tx
          .insert(friendshipsTable)
          .values({ userId, friendId: friend.id, status: "accepted" })
          .onConflictDoUpdate({
            target: [friendshipsTable.userId, friendshipsTable.friendId],
            set: { status: "accepted" },
          });
      });
      res.json({ ok: true, accepted: true, friend: { ...friend, score: await calculateScore(friend.id) } });
      return;
    }
    res.status(409).json({ error: "Solicitação já enviada" });
    return;
  }
  // Create the pending request (one-directional)
  await db.insert(friendshipsTable).values({ userId, friendId: friend.id, status: "pending" });
  res.json({ ok: true, accepted: false, friend: { ...friend } });
});

// POST /social/friends/:requesterId/accept — accept an incoming friend request
router.post("/social/friends/:requesterId/accept", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const requesterId = parseInt(req.params.requesterId ?? "0", 10);
  if (!requesterId) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const [pendingRow] = await db
    .select({ id: friendshipsTable.id })
    .from(friendshipsTable)
    .where(and(
      eq(friendshipsTable.userId, requesterId),
      eq(friendshipsTable.friendId, userId),
      eq(friendshipsTable.status, "pending"),
    ))
    .limit(1);
  if (!pendingRow) {
    res.status(404).json({ error: "Solicitação não encontrada" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .update(friendshipsTable)
      .set({ status: "accepted" })
      .where(eq(friendshipsTable.id, pendingRow.id));
    await tx
      .insert(friendshipsTable)
      .values({ userId, friendId: requesterId, status: "accepted" })
      .onConflictDoUpdate({
        target: [friendshipsTable.userId, friendshipsTable.friendId],
        set: { status: "accepted" },
      });
  });
  res.json({ ok: true });
});

// POST /social/friends/:requesterId/decline — decline or cancel a friend request
router.post("/social/friends/:requesterId/decline", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const requesterId = parseInt(req.params.requesterId ?? "0", 10);
  if (!requesterId) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  // Remove the pending request (either as recipient or requester, for cancel support)
  await db.delete(friendshipsTable).where(
    or(
      and(eq(friendshipsTable.userId, requesterId), eq(friendshipsTable.friendId, userId), eq(friendshipsTable.status, "pending")),
      and(eq(friendshipsTable.userId, userId), eq(friendshipsTable.friendId, requesterId), eq(friendshipsTable.status, "pending")),
    )
  );
  res.json({ ok: true });
});

// DELETE /social/friends/:friendId
router.delete("/social/friends/:friendId", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const friendId = parseInt(req.params.friendId ?? "0", 10);
  if (!friendId) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  await db.delete(friendshipsTable).where(
    or(
      and(eq(friendshipsTable.userId, userId), eq(friendshipsTable.friendId, friendId)),
      and(eq(friendshipsTable.userId, friendId), eq(friendshipsTable.friendId, userId)),
    )
  );
  res.json({ ok: true });
});

// GET /social/search?q=code
router.get("/social/search", requireAuth, async (req, res) => {
  const q = ((req.query.q as string) ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (q.length < 3) {
    res.json([]);
    return;
  }
  const results = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, tier: usersTable.tier, userCode: usersTable.userCode })
    .from(usersTable)
    .where(eq(usersTable.userCode, q))
    .limit(5);
  res.json(results);
});

async function isFriend(userId: number, friendId: number): Promise<boolean> {
  if (!friendId || friendId === userId) return false;
  const [row] = await db
    .select({ id: friendshipsTable.id })
    .from(friendshipsTable)
    .where(and(
      eq(friendshipsTable.userId, userId),
      eq(friendshipsTable.friendId, friendId),
      eq(friendshipsTable.status, "accepted"),
    ))
    .limit(1);
  return !!row;
}

// GET /social/messages/:friendId
router.get("/social/messages/:friendId", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const friendId = parseInt(req.params.friendId ?? "0", 10);
  if (!(await isFriend(userId, friendId))) {
    res.status(403).json({ error: "Não são amigos" });
    return;
  }
  const messages = await db
    .select()
    .from(friendMessagesTable)
    .where(
      or(
        and(eq(friendMessagesTable.senderId, userId), eq(friendMessagesTable.receiverId, friendId)),
        and(eq(friendMessagesTable.senderId, friendId), eq(friendMessagesTable.receiverId, userId)),
      )
    )
    .orderBy(desc(friendMessagesTable.createdAt))
    .limit(60);
  res.json(messages.reverse());
});

// POST /social/messages/:friendId
router.post("/social/messages/:friendId", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const friendId = parseInt(req.params.friendId ?? "0", 10);
  if (!(await isFriend(userId, friendId))) {
    res.status(403).json({ error: "Não são amigos" });
    return;
  }
  const { content } = req.body as { content?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: "Conteúdo vazio" });
    return;
  }
  const [msg] = await db
    .insert(friendMessagesTable)
    .values({ senderId: userId, receiverId: friendId, content: content.trim().slice(0, 500) })
    .returning();
  res.json(msg);
});

// GET /social/shared-note/:friendId
router.get("/social/shared-note/:friendId", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const friendId = parseInt(req.params.friendId ?? "0", 10);
  if (!(await isFriend(userId, friendId))) {
    res.status(403).json({ error: "Não são amigos" });
    return;
  }
  const [u1, u2] = [Math.min(userId, friendId), Math.max(userId, friendId)];
  const [note] = await db
    .select()
    .from(socialNotesTable)
    .where(and(eq(socialNotesTable.user1Id, u1), eq(socialNotesTable.user2Id, u2)))
    .limit(1);
  res.json({ content: note?.content ?? "" });
});

// PUT /social/shared-note/:friendId
router.put("/social/shared-note/:friendId", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const friendId = parseInt(req.params.friendId ?? "0", 10);
  if (!(await isFriend(userId, friendId))) {
    res.status(403).json({ error: "Não são amigos" });
    return;
  }
  const { content } = req.body as { content?: string };
  const [u1, u2] = [Math.min(userId, friendId), Math.max(userId, friendId)];
  await db
    .insert(socialNotesTable)
    .values({ user1Id: u1, user2Id: u2, content: content ?? "" })
    .onConflictDoUpdate({
      target: [socialNotesTable.user1Id, socialNotesTable.user2Id],
      set: { content: content ?? "", updatedAt: new Date() },
    });
  res.json({ ok: true });
});

export default router;
