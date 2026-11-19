import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { PublicUser, Submission,ReviewDecision } from "../types/application.types";
import { findUserById } from "../service/userServices";
import { findSubmissionById, hasProjectAccess} from "../service/submissionServices";
import { saveSubmissionReview, findReviewsBySubmission } from "../service/reviewServices";

// Read a valid submission ID from the URL
const parseId = (value: unknown): number | null => {
    if (
        typeof value !== "string" ||
        !/^[1-9]\d*$/.test(value) ||
        Number(value) > 2147483647
    ) {
        return null;
    }

    return Number(value);
};

// Check that the authenticated account still exists
const getCurrentUser = async ( req: AuthRequest,res: Response ): Promise<PublicUser | null> => {
    if (!req.user) {
        res.status(401).json({
            message: "Authentication required"
        });
        return null;
    }

    const user = await findUserById(req.user.id);

    if (!user) {
        res.status(401).json({
            message: "Your account no longer exists"
        });
        return null;
    }

    return user;
};

// Find the submission and check access to its project
const getAccessibleSubmission = async ( submissionId: number, userId: number, res: Response ): Promise<Submission | null> => {
    const submission = await findSubmissionById(submissionId);

    if (!submission) {
        res.status(404).json({
            message: "Submission not found"
        });
        return null;
    }

    const allowed = await hasProjectAccess(
        submission.project_id,
        userId
    );

    if (!allowed) {
        res.status(403).json({
            message: "You do not have access to this project"
        });
        return null;
    }

    return submission;
};

// Handle database conflicts and unexpected errors
const handleReviewError = ( error: unknown, res: Response ): void => {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23503"
    ) {
        res.status(409).json({
            message: "The referenced submission or reviewer no longer exists"
        });
        return;
    }

    console.error(error);

    res.status(500).json({
        message: "Internal server error"
    });
};

// Share permission checks and saving logic between both review decisions
const submitReviewDecision = async ( req: AuthRequest, res: Response, decision: ReviewDecision ): Promise<void> => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;

        // Only reviewers can approve code or request changes
        if (user.role !== "reviewer") {
            res.status(403).json({
                message: "Only reviewers can review submissions"
            });
            return;
        }

        const submissionId = parseId(req.params.id);

        if (submissionId === null) {
            res.status(400).json({
                message: "Invalid submission ID"
            });
            return;
        }

        // The request body is optional, but must be an object if supplied
        const body = req.body === undefined ? {} : req.body;

        if (
            body === null ||
            typeof body !== "object" ||
            Array.isArray(body)
        ) {
            res.status(400).json({
                message: "The request body must be a JSON object"
            });
            return;
        }

        // The endpoint chooses the decision; users may only supply feedback
        if (Object.keys(body).some(field => field !== "feedback")) {
            res.status(400).json({
                message: "Only feedback may be supplied"
            });
            return;
        }

        if (
            body.feedback !== undefined &&
            typeof body.feedback !== "string"
        ) {
            res.status(400).json({
                message: "Feedback must be a string"
            });
            return;
        }

        const submission = await getAccessibleSubmission(
            submissionId,
            user.id,
            res
        );

        if (!submission) return;

        // A reviewer cannot review code they submitted themselves
        if (submission.submitter_id === user.id) {
            res.status(403).json({
                message: "You cannot review your own submission"
            });
            return;
        }

        // Update the status and save history in one transaction
        const result = await saveSubmissionReview(
            submissionId,
            user.id,
            decision,
            body.feedback
        );

        if (!result) {
            res.status(404).json({
                message: "Submission not found"
            });
            return;
        }

        res.status(200).json({
            message:
                decision === "approved"
                    ? "Submission approved successfully"
                    : "Changes requested successfully",
            submission: result.submission,
            review: result.review
        });
    } catch (error) {
        handleReviewError(error, res);
    }
};

// POST /api/submissions/:id/approve — approve submitted code
export const approveSubmissionHandler = async ( req: AuthRequest, res: Response ): Promise<void> => {
    await submitReviewDecision(req, res, "approved");
};

// POST /api/submissions/:id/request-changes — request improvements
export const requestChangesHandler = async ( req: AuthRequest, res: Response ): Promise<void> => {
    await submitReviewDecision(req, res, "changes_requested");
};

// GET /api/submissions/:id/reviews — read the review history
export const listSubmissionReviewsHandler = async ( req: AuthRequest, res: Response ): Promise<void> => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;

        const submissionId = parseId(req.params.id);

        if (submissionId === null) {
            res.status(400).json({
                message: "Invalid submission ID"
            });
            return;
        }

        const submission = await getAccessibleSubmission(
            submissionId,
            user.id,
            res
        );

        if (!submission) return;

        const reviews = await findReviewsBySubmission(submissionId);

        res.status(200).json({
            message: "Review history retrieved successfully",
            reviews
        });
    } catch (error) {
        handleReviewError(error, res);
    }
};