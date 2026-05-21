const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();

// Create HTTP server and Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [config.socketCorsOrigin || "http://localhost:5173"],
        credentials: true
    }
});

// Store io instance for use in controllers
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join store room for real-time updates
    socket.on('join:store', (storeId) => {
        socket.join(`store:${storeId}`);
        console.log(`Socket ${socket.id} joined store:${storeId}`);
    });

    // Order status updates
    socket.on('order:status', (data) => {
        socket.to(`store:${data.storeId}`).emit('order:status', data);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

const PORT = config.port;
connectDB();

// Middlewares
app.use(cors({
    credentials: true,
    origin: [config.socketCorsOrigin || "http://localhost:5173"]
}));
app.use(express.json());
app.use(cookieParser());

// Root Endpoint
app.get("/", (req, res) => {
    res.json({ message: "Hello from POS Server!" });
});

// API Routes
app.use("/api/user", require("./routes/userRoute"));
app.use("/api/store", require("./routes/storeRoute"));
app.use("/api/role", require("./routes/roleRoute"));
app.use("/api/ingredient", require("./routes/globalIngredientRoute"));
app.use("/api/order", require("./routes/orderRoute"));
app.use("/api/table", require("./routes/tableRoute"));
app.use("/api/payment", require("./routes/paymentRoute"));
app.use("/api/device", require("./routes/deviceRoute"));

// Global Error Handler
app.use(globalErrorHandler);

// Server
server.listen(PORT, () => {
    console.log(`☑️  POS Server is listening on port ${PORT} (with Socket.io)`);
});