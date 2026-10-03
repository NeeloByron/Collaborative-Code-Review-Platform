import { query } from "../config/database";
import { RegisterUser, User, PublicUser, UpdateProfile } from "../types/application.types";

const publicFields = "id, name, email, role, display_picture";

// Fetch safe profile fields only.
export const findUserById = async (id: number): Promise<PublicUser | null> => {
    const result = await query(`SELECT ${publicFields} FROM users WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
};

// Password hashes are fetched only for login.
export const findUserByEmail = async (email: string): Promise<User | null> => {
    const result = await query("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0] ?? null;
};

export const createUser = async (user: RegisterUser, passwordHash: string): Promise<PublicUser> => {
    const result = await query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING ${publicFields}`,
        [user.name, user.email, passwordHash, user.role]
    );
    return result.rows[0];
};

// Field names come from this fixed allowlist, never directly from the request.
export const updateUserById = async (id: number, updates: UpdateProfile): Promise<PublicUser | null> => {
    const fields: (keyof UpdateProfile)[] = ["name", "email", "display_picture"];
    const selected = fields.filter(field => Object.prototype.hasOwnProperty.call(updates, field));
    if (!selected.length) return findUserById(id);
    const values: unknown[] = selected.map(field => updates[field]);
    const assignments = selected.map((field, index) => `${field} = $${index + 1}`);
    values.push(id);
    const result = await query(
        `UPDATE users SET ${assignments.join(", ")} WHERE id = $${values.length}
         RETURNING ${publicFields}`, values
    );
    return result.rows[0] ?? null;
};

// Foreign-key constraints protect related work; the error handler returns 409.
export const deleteUserById = async (id: number): Promise<boolean> => {
    const result = await query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
    return result.rows.length > 0;
};
