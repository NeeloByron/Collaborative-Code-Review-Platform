import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { findUserById } from "../service/userServices";
import { findProjectById } from "../service/projectServices";
import { hasProjectAccess } from "../service/submissionServices";
import { getProjectStats } from "../service/statsServices";

// GET /api/projects/:id/stats - retrieve accessible project statistics.
export const getProjectStatsHandler = async ( req: AuthRequest, res: Response ): Promise<void> => {
    try {
        // Require an authenticated account.
        if (!req.user) {
            res.status(401).json({
                message: "Authentication required"
            });
            return;
        }

        // Check that the project ID is a positive PostgreSQL INTEGER.
        const rawId = req.params.id;

        if (
            typeof rawId !== "string" ||
            !/^[1-9]\d*$/.test(rawId) ||
            Number(rawId) > 2147483647
        ) {
            res.status(400).json({
                message: "Invalid project ID"
            });
            return;
        }

        const projectId = Number(rawId);

        // Reject an account that has been deleted.
        const user = await findUserById(req.user.id);

        if (!user) {
            res.status(401).json({
                message: "Your account no longer exists"
            });
            return;
        }

        // Confirm that the requested project exists.
        const project = await findProjectById(projectId);

        if (!project) {
            res.status(404).json({
                message: "Project not found"
            });
            return;
        }

        // Only the owner and project members can see its statistics.
        const allowed = await hasProjectAccess(projectId, user.id);

        if (!allowed) {
            res.status(403).json({
                message: "You do not have access to this project"
            });
            return;
        }

        const stats = await getProjectStats(projectId);

        res.status(200).json({
            message: "Project statistics retrieved successfully",
            stats
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};