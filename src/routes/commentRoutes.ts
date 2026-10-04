import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { updateCommentHandler, deleteCommentHandler} from "../controllers/commentController";

const router = Router();

// Require a valid login token for every comment route
router.use(authenticate);

// Allow a reviewer to update their own comment
router.patch("/:id", updateCommentHandler);

// Allow a reviewer to delete their own comment
router.delete("/:id", deleteCommentHandler);

export default router;