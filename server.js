const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Fallback route so they don't have to type .html
const fs = require('fs');
app.get('/student', (req, res) => {
    try {
        const content = fs.readFileSync(path.join(__dirname, 'student.html'), 'utf8');
        res.send(content);
    } catch (err) {
        res.status(500).send("Error loading student.html: " + err.message);
    }
});

const PORT = process.env.PORT || 3000;

// Track if the teacher is actually broadcasting the signal
let isBroadcasting = false;

io.on('connection', (socket) => {
    console.log('A device connected:', socket.id);

    // Teacher toggles the broadcast
    socket.on('teacher_toggle_broadcast', (status) => {
        isBroadcasting = status;
        console.log(`[Server] Teacher broadcast active: ${isBroadcasting}`);
    });

    // Student successfully detects the frequency
    socket.on('student_attendance', (data) => {
        if (isBroadcasting) {
            console.log(`[Server] Secure verified check-in: ${data.name} (${data.id})`);
            // Forward the validated student to the teacher's dashboard
            io.emit('teacher_attendance_update', data);
            
            // Confirm back to student
            socket.emit('attendance_success');
        } else {
            console.log(`[Server] Rejected check-in for ${data.name}: Session is closed.`);
            socket.emit('attendance_rejected', 'Session is currently closed by Professor.');
        }
    });

    socket.on('disconnect', () => {
        console.log('Device disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`SecureBeacon Real-Time Server running on http://localhost:${PORT}`);
});
