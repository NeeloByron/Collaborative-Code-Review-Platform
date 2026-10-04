import { pool, query } from "../config/database";
import { Submission, SubmissionStatus, SubmissionReview } from "../types/application.types";

// Describe the submission and history entry returned after a review
interface SavedReview {
    submission: Submission;
    review: SubmissionReview;
}

// Change the submission status and save its history together
export const saveSubmissionReview = async ( submissionId: number, reviewerId: number, status: SubmissionStatus, feedback?: string ): Promise<SavedReview | null> => {
    // Reserve one connection for the entire transaction
    const client = await pool.connect();

    try {
        // Start a transaction so both changes succeed or fail together
        await client.query("BEGIN");

        // Lock the submission while reading its current status
        const existingResult = await client.query<Submission>(
            `SELECT id, project_id, submitter_id, title, code, status
             FROM submissions
             WHERE id = $1
             FOR UPDATE`,
            [submissionId]
        );

        const existingSubmission = existingResult.rows[0];

        if (!existingSubmission) {
            await client.query("ROLLBACK");
            return null;
        }

        // Update the submission's current status
        const submissionResult = await client.query<Submission>(
            `UPDATE submissions
             SET status = $1
             WHERE id = $2
             RETURNING id, project_id, submitter_id, title, code, status`,
            [status, submissionId]
        );

        // Keep the previous status and the reviewer's decision in history
        const reviewResult = await client.query<SubmissionReview>(
            `INSERT INTO reviews (
                submission_id,
                reviewer_id,
                previous_status,
                status,
                feedback
             )
             VALUES ($1, $2, $3, $4, $5)
             RETURNING
                id,
                submission_id,
                reviewer_id,
                previous_status,
                status,
                feedback,
                created_at`,
            [
                submissionId,
                reviewerId,
                existingSubmission.status,
                status,
                feedback?.trim() || null
            ]
        );

        // Save both changes permanently
        await client.query("COMMIT");

        return {
            submission: submissionResult.rows[0],
            review: reviewResult.rows[0]
        };
    } catch (error) {
        // Cancel both changes if something goes wrong
        await client.query("ROLLBACK");

        // Pass the original error to the controller
        throw error;
    } finally {
        // Return the connection to the pool, even after an error
        client.release();
    }
};

// Retrieve a submission's review history, newest first
export const findReviewsBySubmission = async ( submissionId: number ): Promise<SubmissionReview[]> => {
    const result = await query(
        `SELECT
            id,
            submission_id,
            reviewer_id,
            previous_status,
            status,
            feedback,
            created_at
         FROM reviews
         WHERE submission_id = $1
         ORDER BY created_at DESC, id DESC`,
        [submissionId]
    );

    return result.rows;
};