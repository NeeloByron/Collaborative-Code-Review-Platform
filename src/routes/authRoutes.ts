import { Router } from "express";
import { registerUser, loginUser } from "../controllers/authController";
import { validateRegistration, validateLogin } from "../middleware/validationMiddleware";

const router = Router();
router.post("/register", validateRegistration, registerUser);
router.post("/login", validateLogin, loginUser);
export default router;
