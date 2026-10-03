import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { findUserById, updateUserById, deleteUserById } from "../service/userServices";
import { AppError } from "../middleware/errorHandler";

// Routes check authentication, the ID and ownership before running these handlers.
export const getUserProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = await findUserById(Number(req.params.id));
        if (!user) throw new AppError("User not found", 404);
        res.status(200).json({ message: "Profile retrieved successfully", user });
    } catch (error) { next(error); }
};

// PATCH changes only supplied profile fields; passwords and roles cannot be changed here.
export const updateUserProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const user = await updateUserById(Number(req.params.id), req.body);
        if (!user) throw new AppError("User not found", 404);
        res.status(200).json({ message: "Profile updated successfully", user });
    } catch (error) { next(error); }
};

export const deleteUserProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!(await deleteUserById(Number(req.params.id)))) {
            throw new AppError("User not found", 404);
        }
        res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) { next(error); }
};
