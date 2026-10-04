import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { createSubmissionHandler, getSubmissionHandler, updateSubmissionStatusHandler, deleteSubmissionHandler } from "../controllers/submissionController";

const router = Router();

// Require a valid login token for every submission endpoint
router.use(authenticate);

// Submit code to a project the user can access
router.post("/", createSubmissionHandler);

// View a submission from an accessible project
router.get("/:id", getSubmissionHandler);

// Allow an authorised reviewer to change the review status
router.patch("/:id/status", updateSubmissionStatusHandler);

// Allow the original submitter to delete their submission
router.delete("/:id", deleteSubmissionHandler);

export default router;