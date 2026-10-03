import "dotenv/config";
import app from "./app";

if (!process.env.JWT_SECRET) {
    throw new Error("Set JWT_SECRET in .env before starting the server");
}
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
