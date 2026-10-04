import { query } from '../config/database';
import { RegisterUser, User, PublicUser, UpdateProfile } from '../types/application.types';

// find a user by ID without returning their password hash
export const findUserById = async (
    id: number
): Promise<PublicUser | null> => {
    const result = await query(
        "SELECT id, name, email, role, display_picture FROM users WHERE id = $1",
         [id]
    );
    return result.rows[0] ?? null;
}

// find a user by their email 
export const findUserByEmail = async (email: string): Promise<User | null> => {
    const result = await query ("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0] || null;
};

// create a new user 
export const createUser = async (
    user: RegisterUser,
    passwordHash: string
): Promise<User> => {
    const result = await query(
        `INSERT INTO users (name, email, password_hash, role) 
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [ 
            user.name,
            user.email,
            passwordHash,
            user.role
        ]
    );
    return result.rows[0];
};

// update only the profile fields supplied by the user
export const updateUserById = async ( id: number, updates: UpdateProfile ): Promise<PublicUser | null> => {
   const result = await query(
        `UPDATE users 
         SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           display_picture = CASE
             WHEN $3::boolean THEN $4::text
             ELSE display_picture
         END
        WHERE id = $5
        RETURNING id, name, email, role, display_picture`,
        [
            updates.name ?? null,
            updates.email ?? null,
            updates.display_picture !== undefined,
            updates.display_picture ?? null,
            id
        ]
   );
   return result.rows[0] ?? null;
};

// delete the account and report whether a user was removed
export const deleteUserById = async (id: number): Promise<boolean> => {
    const result = await query(
        "DELETE FROM users WHERE id = $1 RETURNING id",
         [id]
    );
    return result.rows.length > 0;
};


// COALESCE keeps the old name or email when you leave that field out.

