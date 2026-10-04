"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// check the login token before allowing a request through
const authenticate = (req, res, next) => {
    const authorization = req.headers.authorization;
    // expect a header containing: Bearer followed by the token
    const parts = authorization === null || authorization === void 0 ? void 0 : authorization.trim().split(/\s+/);
    if (!parts || parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
        res.status(401).json({
            message: "A Bearer token is required"
        });
        return;
    }
    const token = parts[1];
    const jwtSecret = process.env.JWT_SECRET;
    // a missing server setting is a configuration error
    if (!jwtSecret) {
        console.error("JWT_SECRET is not configured");
        res.status(500).json({
            message: "Internal server error"
        });
        return;
    }
    try {
        // check the token's signature and expiry
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret, {
            algorithms: ["HS256"]
        });
        // confirm the token contains the user details we expect
        if (typeof decoded === "string" || typeof decoded.id !== "number" || !Number.isInteger(decoded.id) || decoded.id <= 0 || (decoded.role !== "reviewer" &&
            decoded.role !== "submitter")) {
            res.status(401).json({
                message: "Invalid token"
            });
            return;
        }
        // attach the verified information to this request 
        req.user = {
            id: decoded.id,
            role: decoded.role
        };
    }
    catch (_a) {
        res.status(401).json({
            message: "Invalid or expired token"
        });
        return;
    }
    // The token passed the checks; continue to the next handler
    next();
};
exports.authenticate = authenticate;
