import { Server } from "node:http";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import { findUserById } from "./userServices";
import { UserNotification } from "../types/application.types";

// Keep each user's active connections together
const userConnections = new Map<number, Set<WebSocket>>();

// Attach authenticated WebSocket connections to the HTTP server
export const setupWebSocket = (server: Server): void => {
    const websocketServer = new WebSocketServer({
        noServer: true,
        maxPayload: 16 * 1024
    });

    // Handle requests to switch from HTTP to a WebSocket connection
    server.on("upgrade", (request, socket, head) => {
        // Handle connection errors without crashing the server
        socket.on("error", () => socket.destroy());

        // Accept connections only at our notification address
        if (request.url !== "/ws/notifications") {
            socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
            socket.destroy();
            return;
        }

        const connectUser = async (): Promise<void> => {
            const secret = process.env.JWT_SECRET;

            if (!secret) {
                console.error("JWT_SECRET is not configured");
                socket.write(
                    "HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n"
                );
                socket.destroy();
                return;
            }

            const parts = request.headers.authorization
                ?.trim()
                .split(/\s+/);

            if (
                !parts ||
                parts.length !== 2 ||
                parts[0].toLowerCase() !== "bearer"
            ) {
                socket.write(
                    "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"
                );
                socket.destroy();
                return;
            }

            let decoded;

            // Verify the same JWT used by the REST endpoints
            try {
                decoded = jwt.verify(parts[1], secret, {
                    algorithms: ["HS256"]
                });
            } catch {
                socket.write(
                    "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"
                );
                socket.destroy();
                return;
            }

            // Require a valid account ID and an expiry time
            if (
                typeof decoded === "string" ||
                typeof decoded.id !== "number" ||
                !Number.isInteger(decoded.id) ||
                decoded.id <= 0 ||
                decoded.id > 2147483647 ||
                typeof decoded.exp !== "number" ||
                !Number.isFinite(decoded.exp)
            ) {
                socket.write(
                    "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"
                );
                socket.destroy();
                return;
            }

            const user = await findUserById(decoded.id);

            // Deleted accounts cannot open a connection
            if (!user) {
                socket.write(
                    "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"
                );
                socket.destroy();
                return;
            }

            const expiresInMs = decoded.exp * 1000 - Date.now();

            if (expiresInMs <= 0) {
                socket.write(
                    "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"
                );
                socket.destroy();
                return;
            }

            if (socket.destroyed) return;

            // Complete the connection only after authentication succeeds
            websocketServer.handleUpgrade(
                request,
                socket,
                head,
                connection => {
                    const connections =
                        userConnections.get(user.id) ?? new Set<WebSocket>();

                    connections.add(connection);
                    userConnections.set(user.id, connections);

                    // Close the connection when its login token expires
                    const expiryTimer = setTimeout(() => {
                        connection.close(1008, "Token expired; log in again");
                    }, Math.min(expiresInMs, 2147483647));

                    // Remove closed connections from memory
                    connection.on("close", () => {
                        clearTimeout(expiryTimer);
                        connections.delete(connection);

                        if (connections.size === 0) {
                            userConnections.delete(user.id);
                        }
                    });

                    connection.on("error", () => {
                        connection.terminate();
                    });

                    connection.send(JSON.stringify({
                        type: "connected",
                        message: "Live notifications connected"
                    }));
                }
            );
        };

        // Handle unexpected database or connection errors
        void connectUser().catch(error => {
            console.error(error);

            if (!socket.destroyed) {
                socket.write(
                    "HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n"
                );
                socket.destroy();
            }
        });
    });
};

// Deliver a saved notification only to its recipient's connections
export const sendLiveNotification = async (
    notification: UserNotification
): Promise<void> => {
    const connections = userConnections.get(notification.user_id);

    // Offline users can retrieve the saved notification through the REST API
    if (!connections) return;

    // Recheck the account before delivering an update
    const user = await findUserById(notification.user_id);

    if (!user) {
        for (const connection of connections) {
            connection.close(1008, "Account no longer exists");
        }
        return;
    }

    const message = JSON.stringify({
        type: "notification",
        notification
    });

    for (const connection of connections) {
        if (connection.readyState === WebSocket.OPEN) {
            connection.send(message, error => {
                if (error) connection.terminate();
            });
        }
    }
};