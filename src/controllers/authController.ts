import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { createUser, findUserByEmail } from "../service/userServices";
import { RegisterUser } from "../types/application.types";
import jwt from "jsonwebtoken";

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

    // login in an existing user
    export const loginUser = async (req: Request, res: Response) => {
        try {
            const { email, password } = req.body ?? {};
            
            // check that email and password are non empty strings
            if (
                typeof email !== "string" || !email.trim() || typeof password !== "string" || !password.trim()) {
                      return res.status(400).json({
                        message: "Email and password are required"
                    });
                }

            // Find the account using the supplied email
            const user = await findUserByEmail(email);

            if (!user) {
                return res.status(401).json({
                    message: "Invalid email or password"
                });
            }

            // compare the supplied password with the saved hash
            const passwordMatches = await bcrypt.compare(password, user.password_hash);

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
            const token = jwt.sign(
                { 
                  id: user.id,
                  role: user.role
                },
                 jwtSecret,
                { expiresIn: "1h" }
            );
            
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
        } catch (error) {
            console.error(error);

            return res.status(500).json({
                message: "Internal server error"
            });
        }
    };
