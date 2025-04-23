require('dotenv').config(); 
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const socketController = require('./controllers/socketController');

const app = express();
const server = http.createServer(app);

app.use(express.static('public'))
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || ""; 
const allowedOrigins = allowedOriginsEnv.split(',').map(origin => origin.trim()).filter(Boolean); 

console.log("Allowed CORS Origins:", allowedOrigins.length > 0 ? allowedOrigins : "NONE (Check ALLOWED_ORIGINS env var!)");

const io = new Server(server, {
    cors: {
        origin: allowedOrigins.length > 0 ? allowedOrigins : false, 
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

socketController.initialize(io);

io.on('connection', (socket) => {
    socketController.registerSocketHandlers(socket);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

app.get('/', (req, res) => {
    res.send('Guessing Game Server (MVCS) is running!');
});