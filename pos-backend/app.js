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
    console.log(`[WebSocket] Socket connected: ${socket.id}`);

    // Join store room for real-time updates
    socket.on('join:store', (storeId) => {
        socket.join(`store:${storeId}`);
        console.log(`[WebSocket] Socket ${socket.id} joined store:${storeId}`);
    });

    // Join multiple rooms (for users with access to multiple stores)
    socket.on('join:stores', (storeIds) => {
        if (Array.isArray(storeIds)) {
            storeIds.forEach(id => {
                socket.join(`store:${id}`);
                console.log(`[WebSocket] Socket ${socket.id} joined store:${id}`);
            });
        }
    });

    // Order status updates (client-to-client relay)
    socket.on('order:status', (data) => {
        socket.to(`store:${data.storeId}`).emit('order:status', data);
    });

    // Leave store room (when user logs out or switches store)
    socket.on('leave:store', (storeId) => {
        socket.leave(`store:${storeId}`);
        console.log(`[WebSocket] Socket ${socket.id} left store:${storeId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`[WebSocket] Socket disconnected: ${socket.id}`);
    });

    // Error handling
    socket.on('error', (error) => {
        console.error(`[WebSocket] Error on socket ${socket.id}:`, error.message);
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

// Fase 2 - Menu & Recipe Engine
app.use("/api/category", require("./routes/categoryRoute"));
app.use("/api/product", require("./routes/productRoute"));
app.use("/api/attribute", require("./routes/attributeRoute"));
app.use("/api/recipe", require("./routes/recipeRoute"));
app.use("/api/stock", require("./routes/stockRoute"));

// Fase 4 - Purchase Orders & Suppliers
app.use("/api/supplier", require("./routes/supplierRoutes"));
app.use("/api/purchase-orders", require("./routes/purchaseOrderRoutes"));

// Fase 5 - Dashboard & Analytics
app.use("/api/dashboard", require("./routes/dashboardRoutes"));

// Fase 6 - Subscription & Billing (SaaS)
app.use("/api/subscription", require("./routes/subscriptionRoutes"));

// Fase 7 - Kitchen Display System (KDS)
app.use("/api/kds", require("./routes/kdsRoutes"));

// Fase 8 - Mobile & PDV APIs
app.use("/api/pdv", require("./routes/pdvRoutes"));

// Global Error Handler
app.use(globalErrorHandler);

// Server - only start if not in test mode
if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
        console.log(`☑️  POS Server is listening on port ${PORT} (with Socket.io)`);
    });
}

module.exports = { app, server };