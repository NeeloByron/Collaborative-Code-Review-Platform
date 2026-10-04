import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware";
import { getUserProfile, updateuserProfile, deleteUserProfile } from "../controllers/userController";

const router = Router();

// check the token before fetching the user's profile
router.get("/:id", authenticate, getUserProfile);

// verify the token and allowed before fetching the user's own profile
router.get("/:id", authenticate, authorizeRoles("reviewer","submitter"), getUserProfile);

// Verify the token and role before updating the user's own profile
router.patch("/:id", authenticate, authorizeRoles("reviewer", "submitter"), updateuserProfile);

// verify the token and role before deleting the user's own account
router.delete("/:id", authenticate, authorizeRoles("reviewer", "submitter"), deleteUserProfile);
export default router;