import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware";
import { getUserProfile } from "../controllers/userController";

const router = Router();

// check the token before fetching the user's profile
router.get("/:id", authenticate, getUserProfile);

// verify the token and allowed before fetching the user's own profile
router.get("/:id", authenticate, authorizeRoles("reviewer","submitter"), getUserProfile);

export default router;