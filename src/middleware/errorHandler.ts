import { ErrorRequestHandler } from "express";

// Share predictable errors across controllers and middleware.
export class AppError extends Error {
    constructor(message: string, public statusCode: number) {
        super(message);
    }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof AppError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }
    if (error?.type === "entity.parse.failed") {
        res.status(400).json({ message: "Invalid JSON" });
        return;
    }
    if (error?.type === "entity.too.large") {
        res.status(413).json({ message: "Request body is too large" });
        return;
    }
    if (error?.code === "23505") {
        res.status(409).json({ message: "Email already registered" });
        return;
    }
    if (error?.code === "23503") {
        res.status(409).json({
            message: "This account is linked to projects, submissions or comments and cannot be deleted"
        });
        return;
    }
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
};
