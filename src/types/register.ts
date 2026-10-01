export type UserRole = "reviewer" | "submitter"; 

// a user interface that represents the structure of a user object in the system
export interface User {
    id: number;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
}

// an interface that represents the structure of a user registration object
export interface RegisterUser {
    name: string;
    email: string;
    password: string;
    role: UserRole;
}

// an interface that represents the structure of a user login object
export interface LoginUser {
    email: string;
    password: string;
}

