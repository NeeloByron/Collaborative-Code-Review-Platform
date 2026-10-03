import express from "express";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use((_req, res) => { res.status(404).json({ message: "Endpoint not found" }); });
app.use(errorHandler);
export default app;
