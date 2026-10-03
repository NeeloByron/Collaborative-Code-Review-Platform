import { RequestHandler } from "express";
import { AppError } from "./errorHandler";

function bodyObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new AppError("A JSON object is required", 400);
    }
    return value as Record<string, unknown>;
}

function validateName(value: unknown): string {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 100) {
        throw new AppError("Name must contain between 1 and 100 characters", 400);
    }
    return value.trim();
}

function validateEmail(value: unknown): string {
    if (typeof value !== "string" || value.trim().length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        throw new AppError("A valid email address is required", 400);
    }
    // Preserve case to stay compatible with existing accounts.
    return value.trim();
}

export const validateRegistration: RequestHandler = (req, _res, next) => {
    const body = bodyObject(req.body);
    const name = validateName(body.name);
    const email = validateEmail(body.email);
    if (typeof body.password !== "string" || body.password.length < 8 ||
        !body.password.trim() || Buffer.byteLength(body.password, "utf8") > 72) {
        throw new AppError("Password must have at least 8 characters and at most 72 UTF-8 bytes", 400);
    }
    if (body.role !== "submitter" && body.role !== "reviewer") {
        throw new AppError("Role must be reviewer or submitter", 400);
    }
    req.body = { name, email, password: body.password, role: body.role };
    next();
};

export const validateLogin: RequestHandler = (req, _res, next) => {
    const body = bodyObject(req.body);
    if (typeof body.email !== "string" || !body.email.trim() ||
        typeof body.password !== "string" || !body.password.trim() ||
        Buffer.byteLength(body.password, "utf8") > 72) {
        throw new AppError("Email and password are required and must be valid strings", 400);
    }
    req.body = { email: body.email.trim(), password: body.password };
    next();
};

export const validateProfileUpdate: RequestHandler = (req, _res, next) => {
    const body = bodyObject(req.body);
    const allowed = ["name", "email", "display_picture"];
    const keys = Object.keys(body);
    if (!keys.length || keys.some(key => !allowed.includes(key))) {
        throw new AppError("Provide only name, email or display_picture to update", 400);
    }
    const updates: Record<string, unknown> = {};
    if ("name" in body) updates.name = validateName(body.name);
    if ("email" in body) updates.email = validateEmail(body.email);
    if ("display_picture" in body) {
        if (body.display_picture === null) {
            updates.display_picture = null;
        } else {
            const value = body.display_picture;
            if (typeof value !== "string" || !value.trim() || value.trim().length > 2048) {
                throw new AppError("Display picture must be an HTTP(S) URL or null", 400);
            }
            let url: URL;
            try { url = new URL(value.trim()); }
            catch { throw new AppError("Display picture must be an HTTP(S) URL or null", 400); }
            if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
                throw new AppError("Display picture must be an HTTP(S) URL without credentials", 400);
            }
            // Store the address only; the API never downloads the image.
            updates.display_picture = url.href;
        }
    }
    req.body = updates;
    next();
};

export const validateUserId: RequestHandler = (req, _res, next) => {
    const id = req.params.id;
    // PostgreSQL SERIAL IDs fit in a signed 32-bit integer.
    if (typeof id !== "string" || !/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
        throw new AppError("User ID must be a positive integer up to 2147483647", 400);
    }
    next();
};
