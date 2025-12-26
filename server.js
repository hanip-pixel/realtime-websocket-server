const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const axios = require('axios');

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ server, path: '/' });
const clients = new Map();

const PHP_BACKEND_URL = 'http://localhost/application-tier-php/public';

async function handleClientMessage(ws, message) {
    try {
        const data = JSON.parse(message);
        console.log('Received action:', data.action);
        
        let response;
        
        switch (data.action) {
            case 'GET_ALL_KARYAWAN':
                response = await axios.get(`${PHP_BACKEND_URL}/karyawan`);
                ws.send(JSON.stringify({
                    type: 'GET_ALL_RESPONSE',
                    success: true,
                    data: response.data.data
                }));
                break;
                
            case 'CREATE_KARYAWAN':
                response = await axios.post(`${PHP_BACKEND_URL}/karyawan`, data.payload);
                ws.send(JSON.stringify({
                    type: 'CREATE_RESPONSE',
                    success: true,
                    data: response.data.data
                }));
                
                broadcastExclude(ws, {
                    type: 'KARYAWAN_CREATED',
                    data: response.data.data
                });
                break;
                
            case 'UPDATE_KARYAWAN':
                response = await axios.put(`${PHP_BACKEND_URL}/karyawan/${data.payload.id}`, data.payload);
                ws.send(JSON.stringify({
                    type: 'UPDATE_RESPONSE',
                    success: true
                }));
                
                broadcastExclude(ws, {
                    type: 'KARYAWAN_UPDATED',
                    data: data.payload
                });
                break;
                
            case 'DELETE_KARYAWAN':
                response = await axios.delete(`${PHP_BACKEND_URL}/karyawan/${data.payload.id}`);
                ws.send(JSON.stringify({
                    type: 'DELETE_RESPONSE',
                    success: true
                }));
                
                broadcastExclude(ws, {
                    type: 'KARYAWAN_DELETED',
                    id: data.payload.id
                });
                break;
        }
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        ws.send(JSON.stringify({
            type: 'ERROR',
            success: false,
            message: error.response?.data?.message || error.message
        }));
    }
}

function broadcastExclude(excludeWs, message) {
    const messageStr = JSON.stringify(message);
    clients.forEach((clientInfo, client) => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

wss.on('connection', (ws) => {
    console.log('New client connected');
    clients.set(ws, { connectedAt: new Date() });
    
    ws.on('message', (message) => {
        handleClientMessage(ws, message.toString());
    });
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected');
    });
});

app.use(express.json());
app.post('/notify', (req, res) => {
    const { event, data } = req.body;
    
    const message = JSON.stringify({ type: 'NOTIFICATION', event, data });
    let sentCount = 0;
    
    clients.forEach((clientInfo, client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            sentCount++;
        }
    });
    
    res.json({ success: true, sentTo: sentCount });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
    console.log(`Backend PHP: ${PHP_BACKEND_URL}`);
});