import { Request, Response, NextFunction } from "express";
import { TextDecoder } from "node:util";
import multer from "multer";

// Keep the uploaded file in memory instead of saving it to disk.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024,
        files: 1,
        fields: 2,
        fieldSize: 4096
    }
}).single("file");

// Receive one file and return clear upload errors.
export const uploadSubmissionFile = ( req: Request, res: Response, next: NextFunction ): void => {
    if (!req.is("multipart/form-data")) {
        res.status(400).json({
            message: "Use form-data with file, project_id and title"
        });
        return;
    }

    upload(req, res, (error: unknown) => {
        if (error instanceof multer.MulterError) {
            const tooLarge = error.code === "LIMIT_FILE_SIZE";

            res.status(tooLarge ? 413 : 400).json({
                message: tooLarge
                    ? "File must be 100 KB or smaller"
                    : "Upload one file with project_id and title"
            });
            return;
        }

        if (error) {
            console.error(error);

            res.status(400).json({
                message: "Could not read the file upload"
            });
            return;
        }

        next();
    });
};

// Convert the file into the body our submission controller expects.
export const prepareSubmissionFile = ( req: Request, res: Response, next: NextFunction ): void => {
    if (!req.file) {
        res.status(400).json({
            message: "A text file is required"
        });
        return;
    }

    const body = req.body ?? {};

    // Only accept the two expected text fields.
    if (
        Object.keys(body).some(
            field => !["project_id", "title"].includes(field)
        )
    ) {
        res.status(400).json({
            message: "Only project_id, title and file are allowed"
        });
        return;
    }

    // Form-data sends project_id as text, so validate it first.
    if (
        typeof body.project_id !== "string" ||
        !/^[1-9]\d*$/.test(body.project_id) ||
        Number(body.project_id) > 2147483647
    ) {
        res.status(400).json({
            message: "project_id must be a positive integer"
        });
        return;
    }

    let code: string;

    try {
        // Reject files that cannot be decoded as UTF-8 text.
        code = new TextDecoder("utf-8", { fatal: true })
            .decode(req.file.buffer);
    } catch {
        res.status(400).json({
            message: "File must contain valid UTF-8 text"
        });
        return;
    }

    // Reject common binary control characters.
    // Tabs and normal line breaks remain allowed.
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(code)) {
        res.status(400).json({
            message: "Upload a text/code file, not a binary file"
        });
        return;
    }

    // Reuse the existing controller's title and code validation.
    req.body = {
        project_id: Number(body.project_id),
        title: body.title,
        code
    };

    next();
};