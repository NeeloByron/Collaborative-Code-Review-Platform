import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { PublicUser, Submission, SubmissionStatus } from "../types/application.types";
import { findUserById } from "../service/userServices";
import { findProjectById } from "../service/projectServices";
import { hasProjectAccess, createSubmission, findSubmissionsByProject, findSubmissionById, updateSubmissionStatus, deleteSubmissionById } from "../service/submissionServices";

// Convert a valid positive ID into a number
const parseId = (value: unknown): number | null => {
    const text = typeof value === "number" ? String(value) : value;

    if (
        typeof text !== "string" ||
        !/^[1-9]\d*$/.test(text) ||
        Number(text) > 2147483647
    ) {
        return null;
    }

    return Number(text);
};

// Check that the logged-in user's account still exists
const getCurrentUser = async ( req: AuthRequest, res: Response ): Promise<PublicUser | null> => {
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

// Check that the project exists and the user can access it
const checkProjectAccess = async ( projectId: number, userId: number, res: Response): Promise<boolean> => {
    const project = await findProjectById(projectId);

    if (!project) {
            res.status(404).json({
            message: "Project not found"
        });
        return false;
    }

    if (!(await hasProjectAccess(projectId, userId))) {
        res.status(403).json({
            message: "You do not have access to this project"
        });
        return false;
    }

    return true;
};

// Find a submission and check access to its project
const getAccessibleSubmission = async ( submissionId: number, userId: number,res: Response ): Promise<Submission | null> => {
    const submission = await findSubmissionById(submissionId);

    if (!submission) {
            res.status(404).json({
            message: "Submission not found"
        });
        return null;
    }

    const allowed = await checkProjectAccess(
        submission.project_id,
        userId,
        res
    );

    if (!allowed) return null;

    return submission;
};

// Handle database conflicts and unexpected errors
const handleSubmissionError = ( error: unknown, res: Response ): void => {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23503"
    ) {
        res.status(409).json({
            message:
                "The action conflicts with related records. A referenced record may no longer exist, or the submission has linked feedback."
        });
        return;
    }

    console.error(error);

    res.status(500).json({
        message: "Internal server error"
    });
};

// POST /api/submissions — submit code for review
export const createSubmissionHandler = async ( req: AuthRequest, res: Response ): Promise<void> => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;

        // Only submitters can send code for review
        if (user.role !== "submitter") {
            res.status(403).json({
                message: "Only submitters can submit code"
            });
            return;
        }

        const { project_id, title, code } = req.body ?? {};

        // Require the project ID as a number
        if (typeof project_id !== "number") {
            res.status(400).json({
                message: "project_id must be a positive integer"
            });
            return;
        }

        const projectId = parseId(project_id);

        if (projectId === null) {
            res.status(400).json({
                message: "Invalid project ID"
            });
            return;
        }

        // Check the submission title
        if (
            typeof title !== "string" ||
            !title.trim() ||
            title.trim().length > 200
        ) {
            res.status(400).json({
                message: "Title must contain between 1 and 200 characters"
            });
            return;
        }

        // Check that code was supplied as text
        if (typeof code !== "string" || !code.trim()) {
            res.status(400).json({
                message: "Code must be a non-empty string"
            });
            return;
        }

        const allowed = await checkProjectAccess(
            projectId,
            user.id,
            res
        );

        if (!allowed) return;

        // Preserve code formatting and use the authenticated user's ID
        const submission = await createSubmission(
            {
                project_id: projectId,
                title: title.trim(),
                code
            },
            user.id
        );

        res.status(201).json({
            message: "Code submitted successfully",
            submission
        });
    } catch (error) {
        handleSubmissionError(error, res);
    }
};

// GET /api/projects/:id/submissions — list a project's submissions
export const listProjectSubmissionsHandler = async ( req: AuthRequest, res: Response ): Promise<void> => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;

        const projectId = parseId(req.params.id);

        if (projectId === null) {
            res.status(400).json({
                message: "Invalid project ID"
            });
            return;
        }

        const allowed = await checkProjectAccess(
            projectId,
            user.id,
            res
        );

        if (!allowed) return;

        const submissions = await findSubmissionsByProject(projectId);

        res.status(200).json({
            message: "Submissions retrieved successfully",
            submissions
        });
    } catch (error) {
        handleSubmissionError(error, res);
    }
};

// GET /api/submissions/:id — view one submission
export const getSubmissionHandler = async ( req: AuthRequest, res: Response): Promise<void> => {
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

        res.status(200).json({
            message: "Submission retrieved successfully",
            submission
        });
    } catch (error) {
        handleSubmissionError(error, res);
    }
};

// PATCH /api/submissions/:id/status — change a review status
export const updateSubmissionStatusHandler = async ( req: AuthRequest, res: Response ): Promise<void> => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;

        // Only reviewers can change review status
        if (user.role !== "reviewer") {
            res.status(403).json({
                message: "Only reviewers can change submission status"
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

        const { status } = req.body ?? {};

        const allowedStatuses: SubmissionStatus[] = [
            "pending",
            "in_review",
            "approved",
            "changes_requested"
        ];

        // Reject values outside the allowed status list
        if (
            typeof status !== "string" ||
            !allowedStatuses.includes(status as SubmissionStatus)
        ) {
            res.status(400).json({
                message:
                    "Status must be pending, in_review, approved or changes_requested"
            });
            return;
        }

        const existingSubmission = await getAccessibleSubmission(
            submissionId,
            user.id,
            res
        );

        if (!existingSubmission) return;

        // Prevent users from reviewing their own code
        if (existingSubmission.submitter_id === user.id) {
            res.status(403).json({
                message: "You cannot review your own submission"
            });
            return;
        }

        const submission = await updateSubmissionStatus(
            submissionId,
            status as SubmissionStatus
        );

        // Handle a submission removed after the earlier lookup
        if (!submission) {
            res.status(404).json({
                message: "Submission not found"
            });
            return;
        }

        res.status(200).json({
            message: "Submission status updated successfully",
            submission
        });
    } catch (error) {
        handleSubmissionError(error, res);
    }
};

// DELETE /api/submissions/:id — delete your own submission
export const deleteSubmissionHandler = async ( req: AuthRequest, res: Response ): Promise<void> => {
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

        // Only the original submitter can delete the submission
        if (submission.submitter_id !== user.id) {
            res.status(403).json({
                message: "Only the original submitter can delete this submission"
            });
            return;
        }

        const deleted = await deleteSubmissionById(submissionId);

        if (!deleted) {
            res.status(404).json({
                message: "Submission not found"
            });
            return;
        }

        res.status(200).json({
            message: "Submission deleted successfully"
        });
    } catch (error) {
        handleSubmissionError(error, res);
    }
};