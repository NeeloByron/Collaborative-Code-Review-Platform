import { Router } from "express";
import { registerUser, loginUser } from "../controllers/authController";
import { authenticate, AuthRequest  } from "../middleware/authMiddleware";

const router = Router();

// POST /api/auth/register
router.post("/register", registerUser);

// POST /api/auth/login
router.post("/login", loginUser);

export default router;