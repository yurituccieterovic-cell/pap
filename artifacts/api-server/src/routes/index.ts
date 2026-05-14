import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nodesRouter from "./nodes";
import notesRouter from "./notes";
import progressRouter from "./progress";
import authRouter from "./auth";
import exercisesRouter from "./exercises";
import socialRouter from "./social";
import sitemapRouter from "./sitemap";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sitemapRouter);
router.use(authRouter);
router.use(exercisesRouter);
router.use(socialRouter);
router.use(nodesRouter);
router.use(notesRouter);
router.use(progressRouter);

export default router;
