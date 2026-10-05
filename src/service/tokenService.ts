import jwt from "jsonwebtoken";
import { findUserById } from "./userServices";

// Checks the login token and find the account it belongs to
export const getAuthenticatedAccount = async (authorization: string | undefined) => {
    const secret = process.env.JWT_SECRET;

    // stops if the server has no secret config
    if (!secret) {
         throw new Error("JWT_SECRET is not configured");
    }

    // extract the token from "Bearer token"
    const match = authorization?.match(/^Bearer\s+(\s+)$/i);
    if (!match) return null;

    let decoded;
    try {
        decoded = jwt.verify(match[1], secret, {
            algorithms: ["HS256"]
        });
    } catch {
        return null;
    }

    if (
        typeof decoded === "string" || !Number.isInteger(decoded.id) || decoded.id < 1 || decoded.id > 2147483647 || typeof decoded.exp !== "number" || !Number.isFinite(decoded.exp)
    )
    return null;

    const user = await findUserById(decoded.id);
    if (!user) return null;
    if (user.role !== "reviewer" && user.role !=="submitter") {
       return null;
    }
    if (decoded.exp * 1000 <= Date.now()) return null;
    return {user, expiresAt: decoded.exp * 1000};
}; 