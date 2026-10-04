import { query } from "../config/database";
import { Submission, CreateSubmission, SubmissionStatus } from "../types/application.types";

// Check whether the user owns the project or belongs to it
export const hasProjectAccess = async ( projectId: number, userId: number ): Promise<boolean> => {
    const result = await query(
        `SELECT p.id
         FROM projects p
         WHERE p.id = $1
           AND (
               p.owner_id = $2
               OR EXISTS (
                   SELECT 1
                   FROM project_members pm
                   WHERE pm.project_id = p.id
                     AND pm.user_id = $2
               )
           )`,
        [projectId, userId]
    );

    return result.rows.length > 0;
};

// Save code for review, using the logged-in user's ID
export const createSubmission = async ( submission: CreateSubmission, submitterId: number): Promise<Submission> => {
    const result = await query(
        `INSERT INTO submissions (
            project_id,
            submitter_id,
            title,
            code,
            status
         )
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id, project_id, submitter_id, title, code, status`,
        [
            submission.project_id,
            submitterId,
            submission.title,
            submission.code
        ]
    );

    return result.rows[0];
};

// List all submissions belonging to a project
export const findSubmissionsByProject = async ( projectId: number): Promise<Submission[]> => {
    const result = await query(
        `SELECT id, project_id, submitter_id, title, code, status
         FROM submissions
         WHERE project_id = $1
         ORDER BY id DESC`,
        [projectId]
    );

    return result.rows;
};

// Find one submission using its ID
export const findSubmissionById = async ( submissionId: number): Promise<Submission | null> => {
    const result = await query(
        `SELECT id, project_id, submitter_id, title, code, status
         FROM submissions
         WHERE id = $1`,
        [submissionId]
    );

    return result.rows[0] ?? null;
};

// Change the review status after the controller checks permissions
export const updateSubmissionStatus = async ( submissionId: number,status: SubmissionStatus): Promise<Submission | null> => {
    const result = await query(
        `UPDATE submissions
         SET status = $1
         WHERE id = $2
         RETURNING id, project_id, submitter_id, title, code, status`,
        [status, submissionId]
    );

    return result.rows[0] ?? null;
};

// Delete a submission after the controller checks permissions
export const deleteSubmissionById = async ( submissionId: number): Promise<boolean> => {
    const result = await query(
        `DELETE FROM submissions
         WHERE id = $1
         RETURNING id`,
        [submissionId]
    );

    return result.rows.length > 0;
};