import { query } from "../config/database";
import { Project, CreateProject, ProjectMember } from "../types/application.types";

// create a project owned by the logged in user
export const createProject = async (project: CreateProject, ownerId: number): Promise<Project> => {
    const result = await query(
        `INSERT INTO projects (name, description, owner_id)
         VALUES ($1, $2, $3)
         RETURNING id, name, description, owner_id`,
         [project.name, project.description ?? null, ownerId]
    );
    return result.rows[0];
}

// list projects the user owns/belongs to
export const findProjectsByUser = async (userId: number): Promise<Project[]> => {
    const result = await query(
        `SELECT p.id, p.name, p.description, p.owner_id
        FROM projects p
         WHERE p.owner_id = $1
            OR EXISTS (
                SELECT 1
                FROM project_members pm
                WHERE pm.project_id = p.id
                  AND pm.user_id = $1
            )
         ORDER BY p.id DESC`,
        [userId]
    );

    return result.rows;
};

// Find a project so the controller can check its owner
export const findProjectById = async ( projectId: number): Promise<Project | null> => {
    const result = await query(
        `SELECT id, name, description, owner_id
         FROM projects
         WHERE id = $1`,
        [projectId]
    );

    return result.rows[0] ?? null;
};

// Add a member, returning null if they already belong to the project
export const addProjectMember = async ( projectId: number, userId: number): Promise<ProjectMember | null> => {
    const result = await query(
        `INSERT INTO project_members (project_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (project_id, user_id) DO NOTHING
         RETURNING project_id, user_id`,
        [projectId, userId]
    );

    return result.rows[0] ?? null;
};

// Remove a membership without deleting the user's account
export const removeProjectMember = async ( projectId: number, userId: number): Promise<boolean> => {
    const result = await query(
        `DELETE FROM project_members
         WHERE project_id = $1 AND user_id = $2
         RETURNING user_id`,
        [projectId, userId]
    );

    return result.rows.length > 0;
};