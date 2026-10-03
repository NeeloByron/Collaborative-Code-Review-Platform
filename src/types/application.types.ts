export type UserRole = "reviewer" | "submitter";

export interface User {
    id: number;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
    display_picture: string | null;
}

export type RegisterUser = Pick<User, "name" | "email" | "role"> & {
    password: string;
};
export type LoginUser = Pick<User, "email"> & { password: string };
export type PublicUser = Omit<User, "password_hash">;
export type UpdateProfile = Partial<Pick<User, "name" | "email" | "display_picture">>;
