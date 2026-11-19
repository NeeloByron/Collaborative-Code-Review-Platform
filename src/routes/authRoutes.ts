import { Router } from "express";
import { registerUser, loginUser } from "../controllers/authController";
import { authenticate, AuthRequest  } from "../middleware/authMiddleware";
import { validateRegistration } from "../middleware/validationMiddleware";

const router = Router();

// POST /api/auth/login
router.post("/login", loginUser);

// Validate account details before registering the user.
router.post("/register", validateRegistration, registerUser);

export default router;