import { Response, NextFunction } from "express";
import { AuthRequest } from "./authMiddleware";
import { UserRole } from "../types/application.types";
import { AppError } from "./errorHandler";

// Reuse with authorizeRoles("reviewer") on reviewer-only routes in later sprints.
export const authorizeRoles = (...roles: UserRole[]) => (
    req: AuthRequest, _res: Response, next: NextFunction
): void => {
    if (!req.user) { next(new AppError("Authentication required", 401)); return; }
    if (!roles.includes(req.user.role)) {
        next(new AppError("You do not have permission to perform this action", 403));
        return;
    }
    next();
};

// Both roles can manage their own profile; neither can manage another account.
export const requireProfileOwner = (
    req: AuthRequest, _res: Response, next: NextFunction
): void => {
    if (!req.user) { next(new AppError("Authentication required", 401)); return; }
    if (req.user.id !== Number(req.params.id)) {
        next(new AppError("You can only access your own profile", 403));
        return;
    }
    next();
};
