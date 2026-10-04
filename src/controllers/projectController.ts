import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { findUserById } from "../service/userServices";
import { createProject, findProjectsByUser, findProjectById, addProjectMember, removeProjectMember} from "../service/projectServices";

// Check that an ID is a positive number supported by PostgreSQL
const parseId = (value: unknown): number | null => {
    if (
        typeof value !== "string" ||
        !/^[1-9]\d*$/.test(value) ||
        Number(value) > 2147483647
    ) {
        return null;
    }

    return Number(value);
};

// Handle database errors without exposing internal details
const handleProjectError = (
    error: unknown,
    res: Response
): void => {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23503"
    ) {
        res.status(409).json({
            message: "A referenced user or project no longer exists"
        });
        return;
    }

    console.error(error);

    res.status(500).json({
        message: "Internal server error"
    });
};

// POST /api/projects — create a project for the logged-in user
export const createProjectHandler = async ( req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Authentication required"
            });
            return;
        }

        const { name, description } = req.body ?? {};

        // A project must have a name
        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.trim().length > 150
        ) {
            res.status(400).json({
                message: "Project name must contain between 1 and 150 characters"
            });
            return;
        }

        // Description is optional, but must be text when supplied
        if (
            description !== undefined &&
            typeof description !== "string"
        ) {
            res.status(400).json({
                message: "Description must be a string"
            });
            return;
        }

        // Check that the token's account still exists
        const owner = await findUserById(req.user.id);

        if (!owner) {
            res.status(401).json({
                message: "Your account no longer exists"
            });
            return;
        }

        // Take ownership from the token, never from the request body
        const project = await createProject(
            {
                name: name.trim(),
                description: description?.trim()
            },
            req.user.id
        );

        res.status(201).json({
            message: "Project created successfully",
            project
        });
    } catch (error) {
        handleProjectError(error, res);
    }
};

// GET /api/projects — list projects the user owns or belongs to
export const listProjectsHandler = async ( req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Authentication required"
            });
            return;
        }

        const projects = await findProjectsByUser(req.user.id);

        res.status(200).json({
            message: "Projects retrieved successfully",
            projects
        });
    } catch (error) {
        handleProjectError(error, res);
    }
};

// POST /api/projects/:id/members — let the owner add a reviewer
export const addProjectMemberHandler = async ( req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Authentication required"
            });
            return;
        }

        const projectId = parseId(req.params.id);
        const { user_id } = req.body ?? {};

        // The project ID comes from the URL
        if (projectId === null) {
            res.status(400).json({
                message: "Invalid project ID"
            });
            return;
        }

        // The reviewer's ID comes from the JSON body as a number
        if (
            typeof user_id !== "number" ||
            !Number.isInteger(user_id) ||
            user_id <= 0 ||
            user_id > 2147483647
        ) {
            res.status(400).json({
                message: "user_id must be a positive integer"
            });
            return;
        }

        const project = await findProjectById(projectId);

        if (!project) {
            res.status(404).json({
                message: "Project not found"
            });
            return;
        }

        // Only the project owner can change its membership
        if (project.owner_id !== req.user.id) {
            res.status(403).json({
                message: "Only the project owner can manage members"
            });
            return;
        }

        if (user_id === project.owner_id) {
            res.status(409).json({
                message: "The owner already has access to this project"
            });
            return;
        }

        const reviewer = await findUserById(user_id);

        if (!reviewer) {
            res.status(404).json({
                message: "User not found"
            });
            return;
        }

        // This project requires members to be reviewers
        if (reviewer.role !== "reviewer") {
            res.status(400).json({
                message: "Only reviewers can be added as project members"
            });
            return;
        }

        const member = await addProjectMember(projectId, user_id);

        if (!member) {
            res.status(409).json({
                message: "User is already a project member"
            });
            return;
        }

        res.status(201).json({
            message: "Reviewer added successfully",
            member
        });
    } catch (error) {
        handleProjectError(error, res);
    }
};

// DELETE /api/projects/:id/members/:userId — remove a membership
export const removeProjectMemberHandler = async ( req: AuthRequest, res: Response ): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Authentication required"
            });
            return;
        }

        const projectId = parseId(req.params.id);
        const userId = parseId(req.params.userId);

        if (projectId === null || userId === null) {
            res.status(400).json({
                message: "Invalid project ID or user ID"
            });
            return;
        }

        const project = await findProjectById(projectId);

        if (!project) {
            res.status(404).json({
                message: "Project not found"
            });
            return;
        }

        if (project.owner_id !== req.user.id) {
            res.status(403).json({
                message: "Only the project owner can manage members"
            });
            return;
        }

        // Ownership cannot be removed through the membership endpoint
        if (userId === project.owner_id) {
            res.status(400).json({
                message: "The project owner cannot be removed as a member"
            });
            return;
        }

        const removed = await removeProjectMember(projectId, userId);

        if (!removed) {
            res.status(404).json({
                message: "Project membership not found"
            });
            return;
        }

        res.status(200).json({
            message: "Member removed successfully"
        });
    } catch (error) {
        handleProjectError(error, res);
    }
};