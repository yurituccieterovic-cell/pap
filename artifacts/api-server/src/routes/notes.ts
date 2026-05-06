import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { ListNotesQueryParams, CreateNoteBody, UpdateNoteParams, UpdateNoteBody, DeleteNoteParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/notes", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }

  const query = ListNotesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let notes;
  if (query.data.nodeCode) {
    notes = await db.select().from(notesTable).where(
      and(eq(notesTable.userId, userId), eq(notesTable.nodeCode, query.data.nodeCode))
    );
  } else {
    notes = await db.select().from(notesTable).where(eq(notesTable.userId, userId));
  }

  res.json(notes);
});

router.post("/notes", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }

  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [note] = await db.insert(notesTable).values({
    userId,
    nodeCode: parsed.data.nodeCode ?? null,
    content: parsed.data.content,
  }).returning();

  res.status(201).json(note);
});

router.patch("/notes/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }

  const params = UpdateNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof notesTable.$inferInsert> = {};
  if (parsed.data.content !== undefined) {
    updateData.content = parsed.data.content;
  }

  const [note] = await db.update(notesTable)
    .set(updateData)
    .where(and(eq(notesTable.id, params.data.id), eq(notesTable.userId, userId)))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json(note);
});

router.delete("/notes/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }

  const params = DeleteNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [note] = await db.delete(notesTable)
    .where(and(eq(notesTable.id, params.data.id), eq(notesTable.userId, userId)))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
