import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { getUserProfile } from "../controllers/userController";

const router = Router();

// check the token before fetching the user's profile
router.get("/:id", authenticate, getUserProfile);

export default router;