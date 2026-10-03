import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../types/application.types";
import { findUserById } from "../service/userServices";
import { AppError } from "./errorHandler";

export interface AuthRequest extends Request {
    user?: { id: number; role: UserRole };
}

export const authenticate = async (
    req: AuthRequest, _res: Response, next: NextFunction
): Promise<void> => {
    try {
        const parts = req.headers.authorization?.trim().split(/\s+/);
        if (!parts || parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
            throw new AppError("A Bearer token is required", 401);
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("JWT_SECRET is not configured");
        let decoded;
        try {
            decoded = jwt.verify(parts[1], secret, { algorithms: ["HS256"] });
        } catch {
            throw new AppError("Invalid or expired token", 401);
        }
        if (typeof decoded === "string" || typeof decoded.id !== "number" ||
            !Number.isInteger(decoded.id) || decoded.id <= 0 || decoded.id > 2147483647 ||
            typeof decoded.exp !== "number" ||
            (decoded.role !== "reviewer" && decoded.role !== "submitter")) {
            throw new AppError("Invalid token", 401);
        }
        // Reload the account so deleted accounts and outdated roles cannot use old tokens.
        const user = await findUserById(decoded.id);
        if (!user) throw new AppError("Account no longer exists; please register or log in again", 401);
        req.user = { id: user.id, role: user.role };
        next();
    } catch (error) { next(error); }
};
