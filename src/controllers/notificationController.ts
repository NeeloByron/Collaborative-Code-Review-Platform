import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { findUserById } from "../service/userServices";
import { findNotificationsByUser } from "../service/notificationServices";

// Retrieve notifications belonging to the logged-in user
export const getUserNotificationsHandler = async ( req: AuthRequest,res: Response ): Promise<void> => {
    try {
        // Check that authentication provided the user's details
        if (!req.user) {
            res.status(401).json({
                message: "Authentication required"
            });
            return;
        }

        const rawId = req.params.id;

        // Validate the user ID from the URL
        if (
            typeof rawId !== "string" ||
            !/^[1-9]\d*$/.test(rawId) ||
            Number(rawId) > 2147483647
        ) {
            res.status(400).json({
                message: "Invalid user ID"
            });
            return;
        }

        const userId = Number(rawId);

        // Prevent users from reading someone else's notifications
        if (req.user.id !== userId) {
            res.status(403).json({
                message: "You can only view your own notifications"
            });
            return;
        }

        // Confirm that the logged-in account still exists
        const user = await findUserById(userId);

        if (!user) {
            res.status(401).json({
                message: "Your account no longer exists"
            });
            return;
        }

        // Fetch the user's saved notifications
        const notifications = await findNotificationsByUser(userId);

        res.status(200).json({
            message: "Notifications retrieved successfully",
            notifications
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};