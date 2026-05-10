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
const studentDb = [
    { id: "1NC25MC001", name: "ABHISHEK H N" }, { id: "1NC25MC002", name: "ADITHYA GOWDA N A" },
    { id: "1NC25MC003", name: "BHUVANESHWARI M" }, { id: "1NC25MC004", name: "CHARANA SHREE R" },
    { id: "1NC25MC005", name: "DEEKSHA L D" }, { id: "1NC25MC006", name: "DEEPAK H S" },
    { id: "1NC25MC007", name: "GANGOTHRI G" }, { id: "1NC25MC008", name: "HARI N B" },
    { id: "1NC25MC009", name: "HARSHITH GOWDA" }, { id: "1NC25MC010", name: "HUSSIAN M K" },
    { id: "1NC25MC011", name: "KARTHIK M" }, { id: "1NC25MC012", name: "KUBRA TAJ R A" },
    { id: "1NC25MC013", name: "LIKHITH KUMAR D" }, { id: "1NC25MC014", name: "MANJUNATHA S" },
    { id: "1NC25MC015", name: "MAZEENAKHTAR MAHAMMADIBRAHIM CHUHE" }, { id: "1NC25MC016", name: "PRIYANKA C" },
    { id: "1NC25MC017", name: "PRIYANKA GOPAL GADIVADDAR" }, { id: "1NC25MC018", name: "RAKSHITHA C S" },
    { id: "1NC25MC019", name: "RASHEED B" }, { id: "1NC25MC020", name: "SHRAVANI D R" },
    { id: "1NC25MC021", name: "SHRAVANI K N" }, { id: "1NC25MC022", name: "SHRAVANI M" },
    { id: "1NC25MC023", name: "SOWJANYA N" }, { id: "1NC25MC024", name: "V N KEERTHANA" },
    { id: "1NC25MC025", name: "VARSHA K P" }, { id: "1NC25MC026", name: "VIDHYA R" },
    { id: "1NC25MC027", name: "VIJET TADASAD" }, { id: "1NC25MC028", name: "YESHWANTH M N" }
];

const fs = require('fs');

// CALENDAR OF EVENTS 2025-2026 (Even Semester)
const calendar = {
    holidays: [
        "2026-03-31", // Mahavir Jayanti
        "2026-04-03", // Good Friday
        "2026-04-14", // Ambedkar Jayanti / Ugadi
        "2026-04-20", // Basava Jayanti
        "2026-05-01", // May Day
        "2026-05-28", // Bakrid
        "2026-06-26"  // Muharram
    ],
    iatDates: [
        { name: "IAT-1", start: "2026-06-08", end: "2026-06-13" },
        { name: "IAT-2", start: "2026-07-13", end: "2026-07-17" }
    ],
    workingDays: 90
};

function isHoliday(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    // Sunday (0) or Saturday (6) - Calendar says some Saturdays are off
    if (day === 0) return true;
    
    // Check specific holiday dates
    return calendar.holidays.includes(dateStr);
}

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

    // Save a completed session to history
    socket.on('save_session', (sessionData) => {
        const historyPath = path.join(__dirname, 'attendance_history.json');
        let history = [];
        
        // Normalize logs to P/A/NC
        sessionData.logs = sessionData.logs.map(l => ({
            ...l,
            status: (l.status === "Present" || l.status === "P") ? "P" : (l.status === "NC" ? "NC" : "A")
        }));

        try {
            if (fs.existsSync(historyPath)) {
                history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            }
            history.push(sessionData);
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
        } catch (err) {}
    });

    // Fetch all history
    socket.on('get_history', () => {
        const historyPath = path.join(__dirname, 'attendance_history.json');
        try {
            if (fs.existsSync(historyPath)) {
                const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                socket.emit('history_data', history);
            } else {
                socket.emit('history_data', []);
            }
        } catch (err) {
            socket.emit('history_data', []);
        }
    });

    // Calculate attendance percentage for a specific student
    socket.on('get_student_stats', (usn) => {
        const historyPath = path.join(__dirname, 'attendance_history.json');
        try {
            if (fs.existsSync(historyPath)) {
                const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                
                // Working Days for this specific student's subject classes
                const attendedSessions = history.filter(session => 
                    session.logs.some(log => log.rollNo === usn)
                );

                const missedSessions = history.filter(session => 
                    !session.logs.some(log => log.rollNo === usn)
                );

                // Total working days as per calendar is 90, but we calculate based on sessions held so far
                const totalSessionsSoFar = history.length;
                const percentage = totalSessionsSoFar > 0 ? ((attendedSessions.length / totalSessionsSoFar) * 100).toFixed(1) : 0;
                
                const student = studentDb.find(s => s.id === usn);

                socket.emit('student_stats_data', {
                    usn,
                    name: student ? student.name : "Unknown",
                    percentage,
                    total: totalSessionsSoFar,
                    attended: attendedSessions.length,
                    missedDates: missedSessions.map(s => `${s.date} (${s.subject})`),
                    targetWorkingDays: calendar.workingDays
                });
            } else {
                socket.emit('student_stats_data', { percentage: 0, total: 0, attended: 0, missedDates: [] });
            }
        } catch (err) {
            socket.emit('student_stats_data', { percentage: 0, total: 0, attended: 0, missedDates: [] });
        }
    });

    // Manually update a student's attendance in history
    socket.on('update_attendance', (data) => {
        const { date, subject, usn, newStatus } = data;
        const historyPath = path.join(__dirname, 'attendance_history.json');
        const norm = (newStatus === "P" || newStatus === "Present") ? "P" : (newStatus === "NC" ? "NC" : "A");

        try {
            if (fs.existsSync(historyPath)) {
                let history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                // Find all sessions for this day/subject to keep them in sync
                const sessions = history.filter(s => s.date === date && s.subject === subject);
                
                sessions.forEach(session => {
                    const student = studentDb.find(s => s.id === usn);
                    const logIndex = session.logs.findIndex(l => l.rollNo === usn);
                    
                    if (norm === "P") {
                        if (logIndex === -1) {
                            session.logs.push({ name: student ? student.name : "Manual", rollNo: usn, status: "P" });
                        } else {
                            session.logs[logIndex].status = "P";
                        }
                    } else if (norm === "NC") {
                        if (logIndex === -1) {
                            session.logs.push({ name: student ? student.name : "Manual", rollNo: usn, status: "NC" });
                        } else {
                            session.logs[logIndex].status = "NC";
                        }
                    } else {
                        if (logIndex !== -1) session.logs.splice(logIndex, 1);
                    }
                    session.count = session.logs.filter(l => l.status === "P").length;
                });
                
                fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
                socket.emit('update_success');
            }
        } catch (err) {}
    });

    socket.on('disconnect', () => {
        console.log('Device disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SecureBeacon Real-Time Server running on port ${PORT}`);
});
