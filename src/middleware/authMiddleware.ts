import { Request, Response, NextFunction } from "express";
import { UserRole } from "../types/application.types";
import { getAuthenticatedAccount } from "../service/tokenService";

// Describe the account details attached to a protected request.
export interface AuthRequest extends Request {
    user?: {id: number; 
            role: UserRole;
    };
}

// Check the login token and confirm the account still exists.
export const authenticate = async ( req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const account = await getAuthenticatedAccount(
            req.headers.authorization
        );

        // Reject missing, invalid or expired tokens and missing accounts.
        if (!account) {
            res.status(401).json({
                message: "Missing, invalid or expired login token"
            });
            return;
        }

        // Use the user's current database role.
        req.user = {
            id: account.user.id,
            role: account.user.role
        };
    } catch (error) {
        // Handle unexpected failures, such as database connection errors.
        console.error(error);

        res.status(500).json({
            message: "Internal server error"
        });
        return;
    }

    // Authentication succeeded; continue to the next handler.
    next();
};

// Allow only the specified roles to access a route.
export const authorizeRoles = (...allowedRoles: UserRole[]) => {
    return (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): void => {
        // Authentication must run before this role check.
        if (!req.user) {
            res.status(401).json({
                message: "Authentication required"
            });
            return;
        }

        // Reject users whose role is not allowed.
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                message: "You do not have permission to perform this action"
            });
            return;
        }

        next();
    };
};