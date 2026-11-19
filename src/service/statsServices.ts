import { query } from "../config/database";
import { ProjectStats } from "../types/application.types";

// Calculate statistics using submissions, reviews and comments.
export const getProjectStats = async ( projectId: number ): Promise<ProjectStats> => {
    // These queries are independent, so run them together.
    const [counts, timing, activity, popular] = await Promise.all([
        // Count submissions in each current status.
        query(
            `SELECT
                COUNT(*)::int AS total_submissions,
                COUNT(*) FILTER (
                    WHERE status = 'pending'
                )::int AS pending_count,
                COUNT(*) FILTER (
                    WHERE status = 'in_review'
                )::int AS in_review_count,
                COUNT(*) FILTER (
                    WHERE status = 'approved'
                )::int AS approved_count,
                COUNT(*) FILTER (
                    WHERE status = 'changes_requested'
                )::int AS changes_requested_count
             FROM submissions
             WHERE project_id = $1`,
            [projectId]
        ),

        // Measure hours from submission to its first review decision.
        query(
            `SELECT
                ROUND(
                    AVG(
                        EXTRACT(EPOCH FROM (
                            first_review - created_at
                        )) / 3600
                    ),
                    2
                )::float8 AS average_first_review_hours
             FROM (
                SELECT
                    s.id,
                    s.created_at,
                    MIN(r.created_at) AS first_review
                FROM submissions s
                JOIN reviews r ON r.submission_id = s.id
                WHERE s.project_id = $1
                  AND r.status IN ('approved', 'changes_requested')
                GROUP BY s.id, s.created_at
             ) AS durations
             WHERE first_review >= created_at`,
            [projectId]
        ),

        // Count review decisions and comments separately per person.
        query(
            `WITH activity_events AS (
                SELECT
                    r.reviewer_id AS user_id,
                    1 AS review_count,
                    0 AS comment_count
                FROM reviews r
                JOIN submissions s ON s.id = r.submission_id
                WHERE s.project_id = $1
                  AND r.status IN ('approved', 'changes_requested')

                UNION ALL

                SELECT
                    c.author_id AS user_id,
                    0 AS review_count,
                    1 AS comment_count
                FROM comments c
                JOIN submissions s ON s.id = c.submission_id
                WHERE s.project_id = $1
             )
             SELECT
                u.id AS reviewer_id,
                u.name AS reviewer_name,
                SUM(a.review_count)::int AS review_count,
                SUM(a.comment_count)::int AS comment_count
             FROM activity_events a
             JOIN users u ON u.id = a.user_id
             GROUP BY u.id, u.name
             ORDER BY review_count DESC, comment_count DESC, u.id`,
            [projectId]
        ),

        // Find the submission with the most comments.
        query(
            `SELECT
                s.id AS submission_id,
                s.title,
                COUNT(c.id)::int AS comment_count
             FROM submissions s
             JOIN comments c ON c.submission_id = s.id
             WHERE s.project_id = $1
             GROUP BY s.id, s.title
             ORDER BY comment_count DESC, s.id ASC
             LIMIT 1`,
            [projectId]
        )
    ]);

    const totals = counts.rows[0];

    // Only decided submissions contribute to these percentages.
    const decided =
        totals.approved_count + totals.changes_requested_count;

    const percentage = (count: number): number | null => {
        if (decided === 0) return null;

        return Number(((count / decided) * 100).toFixed(2));
    };

    return {
        project_id: projectId,
        total_submissions: totals.total_submissions,
        pending_count: totals.pending_count,
        in_review_count: totals.in_review_count,
        approved_count: totals.approved_count,
        changes_requested_count: totals.changes_requested_count,
        average_first_review_hours:
            timing.rows[0].average_first_review_hours,
        approval_percentage: percentage(totals.approved_count),
        changes_requested_percentage:
            percentage(totals.changes_requested_count),
        reviewer_activity: activity.rows,
        most_commented_submission: popular.rows[0] ?? null
    };
};