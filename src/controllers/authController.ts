import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createUser, findUserByEmail } from "../service/userServices";
import { AppError } from "../middleware/errorHandler";

// Validation middleware checks the input before this controller runs.
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (await findUserByEmail(req.body.email)) {
            throw new AppError("Email already registered", 409);
        }
        const passwordHash = await bcrypt.hash(req.body.password, 10);
        const user = await createUser(req.body, passwordHash);
        res.status(201).json({ message: "User registered successfully", user });
    } catch (error) { next(error); }
};

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;
        const user = await findUserByEmail(email);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            throw new AppError("Invalid email or password", 401);
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("JWT_SECRET is not configured");
        const token = jwt.sign({ id: user.id, role: user.role }, secret, {
            algorithm: "HS256", expiresIn: "1h"
        });
        const { password_hash, ...publicUser } = user;
        res.status(200).json({ message: "Login successful", token, user: publicUser });
    } catch (error) { next(error); }
};
