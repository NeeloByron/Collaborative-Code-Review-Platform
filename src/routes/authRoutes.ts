import { Router } from "express";
import { registerUser } from "../controllers/authController";

const router = Router();

// POST /api/auth/register
router.post("/register", registerUser);

export default router;