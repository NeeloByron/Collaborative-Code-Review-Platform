import express from "express"
import dotenv from "dotenv"
import authRoutes from "./routes/authRoutes"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(express.json());

// Authentication routes
app.use("/api/auth", authRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
});