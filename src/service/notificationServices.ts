import { query } from "../config/database";
import { UserNotification } from "../types/application.types";

// Save a notification for one user
export const createNotification = async ( userId: number, submissionId: number | null, message: string ): Promise<UserNotification> => {
    const result = await query(
        `INSERT INTO notifications (
            user_id,
            submission_id,
            message
         )
         VALUES ($1, $2, $3)
         RETURNING id, user_id, submission_id, message, created_at`,
        [userId, submissionId, message]
    );

    return result.rows[0];
};

// Retrieve the user's latest 50 notifications
export const findNotificationsByUser = async ( userId: number): Promise<UserNotification[]> => {
    const result = await query(
        `SELECT id, user_id, submission_id, message, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 50`,
        [userId]
    );

    return result.rows;
};