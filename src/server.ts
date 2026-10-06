import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import projectRoutes from "./routes/projectRoutes";
import submissionRoutes from "./routes/submissionRoutes";
import commentRoutes from "./routes/commentRoutes";
import { createServer } from "node:http";
import { setupWebSocket } from "./service/websocketService";
import { validateJsonBody } from "./middleware/validationMiddleware";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(express.json());

// Read JSON bodies and limit their size.
app.use(express.json({ limit: "1mb" }));

// Reject JSON bodies that are not objects.
app.use(validateJsonBody);

// Authentication routes
app.use("/api/auth", authRoutes);

// User profile routes
app.use("/api/users", userRoutes);

// Connect project and project membership endpoints
app.use("/api/projects", projectRoutes);

// connect the code submission endpoints
app.use("/api/submissions", submissionRoutes);

// connects the comment editing and deletion endpoints
app.use("/api/comments", commentRoutes);

// Return JSON when no endpoint matches the request.
app.use((_req, res) => {
    res.status(404).json({
        message: "Route not found"
    });
});

// Register error handling after all routes.
app.use(errorHandler);

// Use one HTTP server for both Express and WebSocket connections
const server = createServer(app);

// Attach authenticated live notifications
setupWebSocket(server);

// Start the application
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});