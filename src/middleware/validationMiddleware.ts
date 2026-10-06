import { Request, Response, NextFunction } from "express";

// JSON request bodies must be objects, not arrays or null.
export const validateJsonBody = ( req: Request, res: Response, next: NextFunction ): void => {
    // Leave file uploads and requests without a body alone.
    if (req.is("application/json") && req.body !== undefined) {
        if (
            req.body === null ||
            typeof req.body !== "object" ||
            Array.isArray(req.body)
        ) {
            res.status(400).json({
                message: "The request body must be a JSON object"
            });
            return;
        }
    }

    next();
};

// Validate registration before the controller creates an account.
export const validateRegistration = ( req: Request, res: Response, next: NextFunction ): void => {
    const { name, email, password, role } = req.body ?? {};

    // Require a name that fits the database column.
    if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100
    ) {
        res.status(400).json({
            message: "Name must contain between 1 and 100 characters"
        });
        return;
    }

    // Require a reasonably formatted email address.
    if (
        typeof email !== "string" ||
        email.trim().length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
        res.status(400).json({
            message: "A valid email address is required"
        });
        return;
    }

    // bcrypt only uses the first 72 bytes of a password.
    if (
        typeof password !== "string" ||
        !password.trim() ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        res.status(400).json({
            message: "Password is required and must not exceed 72 bytes"
        });
        return;
    }

    // Accept only the two roles supported by this application.
    if (role !== "reviewer" && role !== "submitter") {
        res.status(400).json({
            message: "Role must be reviewer or submitter"
        });
        return;
    }

    // Clean surrounding spaces without changing the password.
    req.body.name = name.trim();
    req.body.email = email.trim();

    next();
};