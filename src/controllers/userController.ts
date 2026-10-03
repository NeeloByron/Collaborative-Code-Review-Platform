import e, { raw, Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { findUserById } from "../service/userServices";

// get the logged in user's own profile
export const getUserProfile = async (
    req: AuthRequest, res: Response
): Promise<void> => {
    try {
        // check that authentication provided the user's details
        if (!req.user) {
            res.status(401).json({
                message: "Authentication required"
            });
            return;
        }

        // read the user ID from the URL
        const rawId = req.params.id;

        // reject IDs that are not positive whole numbers
        if (
            typeof rawId !== "string" ||
            !/^[1-9]\d*$/.test(rawId) 
           )  {
                res.status(400).json({
                    message: "User ID must be a positive integer"
                });
                return;
              }
  
        // convert the ID from text into a number
        const id = Number(rawId)

        // rejects numbers too large to represent accurately
        if (!Number.isSafeInteger(id)) {
            res.status(400).json({
                message: "Invalid user ID"
            });
            return;
        }
       
        // Prevents users from accessing someone else's profile
        if (req.user.id !== id) {
            res.status(403).json({
                message: "You can only access your own profile"
            });
            return;
        }

        // look up the profile in the database
        const user = await findUserById(id);

        // handle a user who no lonher exists
        if (!user) {
            res.status(404).json({
                message: "User not found"
            });
            return;
        }

        // send the profile back to the client 
        res.status(200).json({
            message: "Profile retrieved successfully",
            user
        });
    } catch (error) {
        // log unexpected errors and send a general error response
        console.error(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};