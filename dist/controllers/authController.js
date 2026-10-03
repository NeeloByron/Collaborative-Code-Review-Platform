"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUser = exports.registerUser = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const userServices_1 = require("../service/userServices");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Register a new user
const registerUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password, role } = req.body;
        // check if all required fields are provided
        if (!name || !email || !password || !role) {
            return res.status(400).json({
                message: "Name, email, password and role are required"
            });
        }
        // Check if the role is valid
        if (role !== "reviewer" && role !== "submitter") {
            return res.status(400).json({
                message: "Role must be reviewer or submitter"
            });
        }
        // check if the email is already registered
        const existingUser = yield (0, userServices_1.findUserByEmail)(email);
        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }
        // hash the password before storing it
        const passwordHash = yield bcrypt_1.default.hash(password, 10);
        // Create the user
        const newUser = yield (0, userServices_1.createUser)({
            name,
            email,
            password,
            role
        }, passwordHash);
        // Do not return password_hash
        const { password_hash } = newUser, publicUser = __rest(newUser, ["password_hash"]);
        return res.status(201).json({
            message: "User registered successfully",
            user: publicUser
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});
exports.registerUser = registerUser;
// login in an existing user
const loginUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { email, password } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
        // check that email and password are non empty strings
        if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password.trim()) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }
        // Find the account using the supplied email
        const user = yield (0, userServices_1.findUserByEmail)(email);
        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        // compare the supplied password with the saved hash
        const passwordMatches = yield bcrypt_1.default.compare(password, user.password_hash);
        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        // Read the private key used to sign login tokens
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error("JWT_SECRET is not configured");
            return res.status(500).json({
                message: "Internal server error"
            });
        }
        // create a signed token that expires after 1 hour
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            role: user.role
        }, jwtSecret, { expiresIn: "1h" });
        // return only safe user details
        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});
exports.loginUser = loginUser;
