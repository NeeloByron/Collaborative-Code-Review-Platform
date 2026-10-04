import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { createSubmissionHandler, getSubmissionHandler, updateSubmissionStatusHandler, deleteSubmissionHandler } from "../controllers/submissionController";
import { createCommentHandler, listCommentsHandler } from "../controllers/commentController";
const router = Router();

// Require a valid login token for every submission endpoint
router.use(authenticate);

// allows a reviewer with project access to comment on a submission
router.post("/:id/comments", createCommentHandler);

// allows users with project access to read submission comments
router.get("/:id/comments", listCommentsHandler);

// Submit code to a project the user can access
router.post("/", createSubmissionHandler);

// View a submission from an accessible project
router.get("/:id", getSubmissionHandler);

// Allow an authorised reviewer to change the review status
router.patch("/:id/status", updateSubmissionStatusHandler);

// Allow the original submitter to delete their submission
router.delete("/:id", deleteSubmissionHandler);

export default router;