import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { PublicUser, Submission, ReviewComment, UpdateComment } from "../types/application.types";
import { findUserById } from "../service/userServices";
import { findSubmissionById, hasProjectAccess } from "../service/submissionServices";
import { createComment, findCommentsBySubmission, findCommentById, updateCommentById, deleteCommentById } from "../service/commentServices";

// Read a positive PostgreSQL INTEGER ID from the URL
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
const getCurrentUser = async ( req: AuthRequest, res: Response): Promise<PublicUser | null> => {
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
const getAccessibleSubmission = async ( submissionId: number, userId: number, res: Response): Promise<Submission | null> => {
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

// Check comment ownership and current project access before changes
const getEditableComment = async ( commentId: number, userId: number, res: Response ): Promise<{ comment: ReviewComment; submission: Submission;} | null> => {
    const comment = await findCommentById(commentId);

    if (!comment) {
        res.status(404).json({
            message: "Comment not found"
        });
        return null;
    }

    if (comment.author_id !== userId) {
        res.status(403).json({
            message: "You can only edit or delete your own comments"
        });
        return null;
    }

    const submission = await getAccessibleSubmission(
        comment.submission_id,
        userId,
        res
    );

    if (!submission) return null;

    return { comment, submission };
};

// Validate comment fields for either creation or a partial update
const validateCommentBody = ( body: unknown, code: string, isUpdate: boolean, res: Response): UpdateComment | null => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        res.status(400).json({
            message: "A JSON object is required"
        });
        return null;
    }

    const input = body as Record<string, unknown>;
    const fields = Object.keys(input);
    const allowedFields = ["content", "line_number"];

    if (
        fields.length === 0 ||
        fields.some(field => !allowedFields.includes(field))
    ) {
        res.status(400).json({
            message: "Provide only content or line_number"
        });
        return null;
    }

    const updates: UpdateComment = {};

    // New comments require text; updates can leave existing text unchanged
    if (!isUpdate || "content" in input) {
        if (
            typeof input.content !== "string" ||
            !input.content.trim()
        ) {
            res.status(400).json({
                message: "Comment content must be a non-empty string"
            });
            return null;
        }

        updates.content = input.content.trim();
    }

    // An inline comment must point to an existing line of code
    if ("line_number" in input) {
        if (input.line_number === null) {
            updates.line_number = null;
        } else {
            const lineCount = code.split(/\r\n|\n|\r/).length;

            if (
                typeof input.line_number !== "number" ||
                !Number.isInteger(input.line_number) ||
                input.line_number < 1 ||
                input.line_number > lineCount
            ) {
                res.status(400).json({
                    message: `line_number must be between 1 and ${lineCount}, or null`
                });
                return null;
            }

            updates.line_number = input.line_number;
        }
    }

    return updates;
};

// Handle related-record conflicts and unexpected server errors
const handleCommentError = ( error: unknown, res: Response ): void => {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23503"
    ) {
        res.status(409).json({
            message: "The referenced submission or user no longer exists"
        });
        return;
    }

    console.error(error);

    res.status(500).json({
        message: "Internal server error"
    });
};

// POST /api/submissions/:id/comments — add reviewer feedback
export const createCommentHandler = async ( req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;

        if (user.role !== "reviewer") {
            res.status(403).json({
                message: "Only reviewers can add comments"
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

        const submission = await getAccessibleSubmission(
            submissionId,
            user.id,
            res
        );

        if (!submission) return;

        const input = validateCommentBody(
            req.body,
            submission.code,
            false,
            res
        );

        if (!input || input.content === undefined) return;

        // Use the authenticated reviewer as the comment's author
        const comment = await createComment(
            submissionId,
            user.id,
            {
                content: input.content,
                line_number: input.line_number
            }
        );

        res.status(201).json({
            message: "Comment added successfully",
            comment
        });
    } catch (error) {
        handleCommentError(error, res);
    }
};

// GET /api/submissions/:id/comments — read accessible feedback
export const listCommentsHandler = async ( req: AuthRequest, res: Response): Promise<void> => {
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

        const comments = await findCommentsBySubmission(submissionId);

        res.status(200).json({
            message: "Comments retrieved successfully",
            comments
        });
    } catch (error) {
        handleCommentError(error, res);
    }
};

// PATCH /api/comments/:id — edit your own reviewer feedback
export const updateCommentHandler = async ( req: AuthRequest,res: Response): Promise<void> => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;

        if (user.role !== "reviewer") {
            res.status(403).json({
                message: "Only reviewers can edit comments"
            });
            return;
        }

        const commentId = parseId(req.params.id);

        if (commentId === null) {
            res.status(400).json({
                message: "Invalid comment ID"
            });
            return;
        }

        const existing = await getEditableComment(
            commentId,
            user.id,
            res
        );

        if (!existing) return;

        const updates = validateCommentBody(
            req.body,
            existing.submission.code,
            true,
            res
        );

        if (!updates) return;

        const comment = await updateCommentById(
            commentId,
            user.id,
            updates
        );

        if (!comment) {
            res.status(404).json({
                message: "Comment not found"
            });
            return;
        }

        res.status(200).json({
            message: "Comment updated successfully",
            comment
        });
    } catch (error) {
        handleCommentError(error, res);
    }
};

// DELETE /api/comments/:id — remove your own reviewer feedback
export const deleteCommentHandler = async ( req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;

        if (user.role !== "reviewer") {
            res.status(403).json({
                message: "Only reviewers can delete comments"
            });
            return;
        }

        const commentId = parseId(req.params.id);

        if (commentId === null) {
            res.status(400).json({
                message: "Invalid comment ID"
            });
            return;
        }

        const existing = await getEditableComment(
            commentId,
            user.id,
            res
        );

        if (!existing) return;

        const deleted = await deleteCommentById(commentId, user.id);

        if (!deleted) {
            res.status(404).json({
                message: "Comment not found"
            });
            return;
        }

        res.status(200).json({
            message: "Comment deleted successfully"
        });
    } catch (error) {
        handleCommentError(error, res);
    }
};