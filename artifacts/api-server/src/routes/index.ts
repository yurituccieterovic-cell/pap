import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nodesRouter from "./nodes";
import notesRouter from "./notes";
import progressRouter from "./progress";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nodesRouter);
router.use(notesRouter);
router.use(progressRouter);

export default router;
