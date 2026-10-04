import e, { raw, Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { findUserById, updateUserById, deleteUserById } from "../service/userServices";
import { UpdateProfile } from "../types/application.types";

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

// check the URL ID and ensure it belongs to the logged in user
const getOwnProfileId = (req: AuthRequest, res: Response): number | null => {
    if (!req.user) {
        res.status(401).json({
            message: "Authentication required"
        }); 
        return null;
    }

    const rawId = req.params.id;

    if( 
        typeof rawId !== "string" || !/^[1-9]\d*$/.test(rawId) || Number(rawId) > 2147483647 ) {
            res.status(400).json({
                message: "Invalid user ID"
            });
             return null;
    }
    
    const id = Number(rawId);

    if (req.user.id !== id) {
        res.status(403).json({
            message: "You can only manage your own profile"
        });
        return null;
    }
    return id;
};

// update the logged in user's name, email or display  picture
export const updateuserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = getOwnProfileId(req, res);
        if (id === null) return;

        const body = req.body;

       // only accept a JSON object
       if (!body || typeof body !== "object" || Array.isArray(body)) {
         res.status(400).json({
            message: "A JSON object is required"
         });
         return;
       }
    
       const allowedFields = ["name", "email", "display_picture"];
       const fields = Object.keys(body);

       // reject empty updates and changes to protected fields
       if (
           fields.length == 0 || fields.some(field => !allowedFields.includes(field))
       ) {
          res.status(400).json({
            message: "Provide only name, email or display_picture"
          });
          return;
       }

       const updates: UpdateProfile = {};

       // validate and clean the name if supplied
       if ("name" in body) {
            if (
                typeof body.name !== "string" ||
                !body.name.trim() ||
                body.name.trim().length > 100
            ) {
                res.status(400).json({
                    message: "Name must contain between 1 and 100 characters"
                });
                return;
            }

            updates.name = body.name.trim();
        }

        // Validate and clean the email if supplied
        if ("email" in body) {
            if (
                typeof body.email !== "string" ||
                body.email.trim().length > 255 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
            ) {
                res.status(400).json({
                    message: "A valid email address is required"
                });
                return;
            }

            updates.email = body.email.trim();
        }

        // Accept an HTTP(S) picture URL, or null to remove it
        if ("display_picture" in body) {
            if (body.display_picture === null) {
                updates.display_picture = null;
            } else {
                if (
                    typeof body.display_picture !== "string" ||
                    !body.display_picture.trim() ||
                    body.display_picture.trim().length > 2048
                ) {
                    res.status(400).json({
                        message: "Display picture must be an HTTP(S) URL or null"
                    });
                    return;
                }

                let pictureUrl: URL;

                try {
                    pictureUrl = new URL(body.display_picture.trim());
                } catch {
                    res.status(400).json({
                        message: "Invalid display picture URL"
                    });
                    return;
                }

                if (
                    !["http:", "https:"].includes(pictureUrl.protocol) ||
                    pictureUrl.username ||
                    pictureUrl.password
                ) {
                    res.status(400).json({
                        message: "Use an HTTP(S) picture URL without credentials"
                    });
                    return;
                }

                updates.display_picture = pictureUrl.href;
            }
        }

        // Save the validated fields
        const user = await updateUserById(id, updates);

        if (!user) {
            res.status(404).json({
                message: "User not found"
            });
            return;
        }

        res.status(200).json({
            message: "Profile updated successfully",
            user
        });
    } catch (error) {
        // PostgreSQL rejects an email already used by another account
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "23505"
        ) {
            res.status(409).json({
                message: "Email already registered"
            });
            return;
        }

        console.error(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};

// Delete the logged-in user's own account
export const deleteUserProfile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const id = getOwnProfileId(req, res);
        if (id === null) return;

        const deleted = await deleteUserById(id);

        if (!deleted) {
            res.status(404).json({
                message: "User not found"
            });
            return;
        }

        res.status(200).json({
            message: "Account deleted successfully"
        });
    } catch (error) {
        // Keep accounts that are still referenced by project or review records
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "23503"
        ) {
            res.status(409).json({
                message: "Cannot delete an account linked to projects, submissions or comments"
            });
            return;
        }

        console.error(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};