import { query } from "../config/database";
import { ReviewComment, CreateComment, UpdateComment } from "../types/application.types";

// Add feedback using the authenticated reviewer's ID
export const createComment = async ( submissionId: number, authorId: number, comment: CreateComment ): Promise<ReviewComment> => {
    const result = await query(
        `INSERT INTO comments (
            submission_id,
            author_id,
            content,
            line_number
         )
         VALUES ($1, $2, $3, $4)
         RETURNING id, submission_id, author_id, content, line_number`,
        [
            submissionId,
            authorId,
            comment.content,
            comment.line_number ?? null
        ]
    );

    return result.rows[0];
};

// List feedback for a submission, starting with the oldest comment
export const findCommentsBySubmission = async ( submissionId: number ): Promise<ReviewComment[]> => {
    const result = await query(
        `SELECT id, submission_id, author_id, content, line_number
         FROM comments
         WHERE submission_id = $1
         ORDER BY id ASC`,
        [submissionId]
    );

    return result.rows;
};

// Find a comment so the controller can check access and ownership
export const findCommentById = async ( commentId: number ): Promise<ReviewComment | null> => {
    const result = await query(
        `SELECT id, submission_id, author_id, content, line_number
         FROM comments
         WHERE id = $1`,
        [commentId]
    );

    return result.rows[0] ?? null;
};

// Update supplied fields only, and require the matching author ID
export const updateCommentById = async ( commentId: number, authorId: number, updates: UpdateComment ): Promise<ReviewComment | null> => {
    const result = await query(
        `UPDATE comments
         SET content = COALESCE($1, content),
             line_number = CASE
                 WHEN $2::boolean THEN $3::integer
                 ELSE line_number
             END
         WHERE id = $4 AND author_id = $5
         RETURNING id, submission_id, author_id, content, line_number`,
        [
            updates.content ?? null,
            updates.line_number !== undefined,
            updates.line_number ?? null,
            commentId,
            authorId
        ]
    );

    return result.rows[0] ?? null;
};

// Delete only a comment belonging to the supplied author
export const deleteCommentById = async ( commentId: number, authorId: number): Promise<boolean> => {
    const result = await query(
        `DELETE FROM comments
         WHERE id = $1 AND author_id = $2
         RETURNING id`,
        [commentId, authorId]
    );

    return result.rows.length > 0;
};