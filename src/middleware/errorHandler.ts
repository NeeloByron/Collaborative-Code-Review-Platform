import { Request, Response, NextFunction } from "express";

// Handle unexpected failures forwarded by routes or middleware.
export const errorHandler = ( error: unknown, _req: Request, res: Response, next: NextFunction ): void => {
    // Let Express finish handling an error if a response already started.
    if (res.headersSent) {
        next(error);
        return;
    }

    const details = (
        typeof error === "object" && error !== null
            ? error
            : {}
    ) as {
        type?: string;
        code?: string;
    };

    // Handle incorrectly written JSON.
    if (details.type === "entity.parse.failed") {
        res.status(400).json({
            message: "Invalid JSON request body"
        });
        return;
    }

    // Handle bodies larger than the configured JSON limit.
    if (details.type === "entity.too.large") {
        res.status(413).json({
            message: "Request body is too large"
        });
        return;
    }

    // Handle unsupported character sets or compression.
    if (
        details.type === "charset.unsupported" ||
        details.type === "encoding.unsupported"
    ) {
        res.status(415).json({
            message: "Unsupported request-body encoding"
        });
        return;
    }

    // Handle duplicate values protected by a database constraint.
    if (details.code === "23505") {
        res.status(409).json({
            message: "A record with that value already exists"
        });
        return;
    }

    // Handle missing or still-referenced related records.
    if (details.code === "23503") {
        res.status(409).json({
            message: "A related record is missing or still in use"
        });
        return;
    }

    // Log details on the server without exposing them to the user.
    console.error("Unexpected request error:", error);

    res.status(500).json({
        message: "Internal server error"
    });
};