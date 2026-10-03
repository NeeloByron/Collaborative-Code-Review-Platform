import { query } from '../config/database';
import { RegisterUser, User, PublicUser } from '../types/application.types';

// find a user by ID without returning their password hash
export const findUserById = async (
    id: number
): Promise<PublicUser | null> => {
    const result = await query(
        "SELECT id, name, email, role FROM users WHERE id = $1",
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

