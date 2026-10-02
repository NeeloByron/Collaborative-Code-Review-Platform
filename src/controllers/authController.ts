import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { createUser, findUserByEmail } from "../service/userServices";
import { RegisterUser } from "../types/application.types";

// Register a new user
export const registerUser = async (req: Request, res: Response) => {
    try {
        const { name, email, password, role }: RegisterUser = req.body;

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
       const existingUser = await findUserByEmail(email);

       if (existingUser) {
        return res.status(409).json({
            message: "Email already registered"
        });
       }

       // hash the password before storing it
       const passwordHash = await bcrypt.hash(password, 10);

       // Create the user
       const newUser = await createUser(
        {
            name, 
            email,
            password,
            role
        },
         passwordHash
         
       );

       // Do not return password_hash
       const { password_hash, ...publicUser} = newUser;

       return res.status(201).json({
        message: "User registered successfully",
        user: publicUser

       });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Internal server error"
        });
      }
    };
