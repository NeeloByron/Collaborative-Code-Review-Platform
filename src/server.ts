import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import projectRoutes from "./routes/projectRoutes";
import submissionRoutes from "./routes/submissionRoutes";
import commentRoutes from "./routes/commentRoutes";
import { createServer } from "node:http";
import { setupWebSocket } from "./service/websocketService";

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(express.json());

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

// Use one HTTP server for both Express and WebSocket connections
const server = createServer(app);

// Attach authenticated live notifications
setupWebSocket(server);

// Start the application
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});