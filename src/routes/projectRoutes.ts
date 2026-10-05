import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { createProjectHandler, listProjectsHandler, addProjectMemberHandler, removeProjectMemberHandler } from "../controllers/projectController";
import { listProjectSubmissionsHandler } from "../controllers/submissionController";

const router = Router();

// Require a valid login token for every project endpoint
router.use(authenticate);

// Create a project owned by the logged-in user
router.post("/", createProjectHandler);

// List projects the logged-in user owns or belongs to
router.get("/", listProjectsHandler);

// Allow the project owner to add a reviewer
router.post("/:id/members", addProjectMemberHandler);

// Allow the project owner to remove a member
router.delete("/:id/members/:userId", removeProjectMemberHandler);

// list submissions belonging to a project the user can access
router.get("/:id/submissions", listProjectSubmissionsHandler);

export default router;