import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { authorizeRoles, requireProfileOwner } from "../middleware/authorizationMiddleware";
import { validateUserId, validateProfileUpdate } from "../middleware/validationMiddleware";
import { getUserProfile, updateUserProfile, deleteUserProfile } from "../controllers/userController";

const router = Router();
// Both roles may manage their own profile, but not another user's profile.
router.use(authenticate, authorizeRoles("reviewer", "submitter"));
router.get("/:id", validateUserId, requireProfileOwner, getUserProfile);
router.patch("/:id", validateUserId, requireProfileOwner, validateProfileUpdate, updateUserProfile);
router.delete("/:id", validateUserId, requireProfileOwner, deleteUserProfile);
export default router;
