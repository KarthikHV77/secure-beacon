// Faculty & Timetable Data
const facultyDb = [
  { id: "MAH01", name: "Prof. Mahendra C D", subjects: ["Computer Networks", "Tutorial (CN)"] },
  { id: "SIN01", name: "Prof. Sinchana M S", subjects: ["Java (OOP)", "Java Lab", "Tutorial (Java)"] },
  { id: "PAR01", name: "Dr. Parthasarathi Murugesan", subjects: ["DAA", "DAA Lab", "Tutorial (DAA)"] },
  { id: "MLK01", name: "Prof. Mahalakshmi C K", subjects: ["Web Technologies", "Web Lab", "Tutorial (Web)"] },
  { id: "SUB01", name: "Prof. Subhash N S", subjects: ["Professional Elective 1 (ERP)"] },
  { id: "SAM01", name: "Prof. Samreen Firoz Ahammed", subjects: ["Professional Elective 1 (Data Mining)", "Mini Project-Seminar"] },
  { id: "KAR01", name: "Prof. Karthik H V", subjects: ["Professional Elective 2 (Cryptography)", "Web Lab"] },
  { id: "BHA01", name: "Prof. Bhavana K", subjects: ["Professional Elective 2 (AI)"] },
  { id: "TORI", name: "TORI", subjects: ["AEC", "Ability Enhancement Courses"] }
];

const timetable = {
  "Monday": [
    { start: "09:00", end: "10:50", subject: "Java (OOP)", facultyId: "SIN01" },
    { start: "11:00", end: "12:50", subject: "Web Technologies", facultyId: "MLK01" },
    { start: "13:40", end: "14:30", subject: "Professional Elective 2 (Cryptography)", facultyId: "KAR01" },
    { start: "14:30", end: "15:20", subject: "Computer Networks", facultyId: "MAH01" },
    { start: "15:20", end: "16:00", subject: "Tutorial (Java)", facultyId: "SIN01" }
  ],
  "Tuesday": [
    { start: "09:00", end: "10:50", subject: "Java (OOP)", facultyId: "SIN01" },
    { start: "11:00", end: "12:50", subject: "Web Technologies", facultyId: "MLK01" },
    { start: "13:40", end: "14:30", subject: "Computer Networks", facultyId: "MAH01" },
    { start: "14:30", end: "15:20", subject: "Professional Elective 1 (ERP)", facultyId: "SUB01" }
  ],
  "Wednesday": [
    { start: "09:00", end: "10:50", subject: "Java Lab", facultyId: "SIN01" },
    { start: "11:00", end: "12:50", subject: "Web Lab", facultyId: "MLK01" },
    { start: "13:40", end: "14:30", subject: "Tutorial (Web)", facultyId: "MLK01" },
    { start: "14:30", end: "15:20", subject: "Professional Elective 2", facultyId: "Various" }
  ],
  "Thursday": [
    { start: "09:00", end: "10:50", subject: "DAA", facultyId: "PAR01" },
    { start: "11:00", end: "12:50", subject: "Mini Project/Seminar", facultyId: "SAM01" },
    { start: "13:40", end: "14:30", subject: "Professional Elective 1", facultyId: "Various" },
    { start: "14:30", end: "15:20", subject: "Professional Elective 2", facultyId: "Various" },
    { start: "15:20", end: "16:00", subject: "Computer Networks", facultyId: "MAH01" }
  ],
  "Friday": [
    { start: "09:00", end: "10:50", subject: "DAA Lab", facultyId: "PAR01" },
    { start: "11:00", end: "12:50", subject: "Mini Project/Seminar/Paper", facultyId: "SAM01" },
    { start: "13:40", end: "14:30", subject: "Professional Elective 1", facultyId: "Various" },
    { start: "14:30", end: "15:20", subject: "Tutorial (CN)", facultyId: "MAH01" },
    { start: "15:20", end: "16:00", subject: "AEC", facultyId: "TORI" }
  ],
  "Saturday": [
    { start: "09:00", end: "10:50", subject: "DAA", facultyId: "PAR01" },
    { start: "11:00", end: "12:50", subject: "Ability Enhancement Courses (T)", facultyId: "TORI" }
  ]
};

// State Management
const state = {
    currentTeacher: null,
    isBroadcasting: false,
    enrolled: 28,
    presentCount: 0,
    attendanceLogs: [],
    chart: null,
    audioCtx: null,
    oscillator: null,
    socket: null
};

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const mainDashboard = document.getElementById('main-dashboard');
const teacherIdInput = document.getElementById('teacherId');
const teacherPassInput = document.getElementById('teacherPass');
const loginBtn = document.getElementById('teacherLoginBtn');
const loginError = document.getElementById('loginError');
const displayTeacherName = document.getElementById('displayTeacherName');
const currentClassSelect = document.getElementById('currentClass');
const toggleBeaconBtn = document.getElementById('toggleBeaconBtn');
const beaconStatusText = document.getElementById('beaconStatusText');
const pulseRing = document.querySelector('.pulse-ring');
const presentCountEl = document.getElementById('presentCount');
const absentCountEl = document.getElementById('absentCount');
const liveLogBody = document.getElementById('liveLogBody');

// Initialize
function init() {
    const teacherId = localStorage.getItem('user_id');
    const teacher = facultyDb.find(t => t.id === teacherId);

    if (teacher) {
        state.currentTeacher = teacher;
        mainDashboard.style.display = 'flex';
        displayTeacherName.textContent = teacher.name;
        startDashboard();
    } else {
        window.location.href = '/index.html';
    }
}

function startDashboard() {
    initChart();
    populateClasses();
    setupSocket();
    setupEventListeners();
}

function populateClasses() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = new Date();
    const currentDay = days[now.getDay()];
    const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

    // Add teacher's own subjects first
    state.currentTeacher.subjects.forEach(subject => {
        const opt = document.createElement('option');
        opt.value = subject;
        opt.textContent = subject;
        currentClassSelect.appendChild(opt);
    });

    // Check timetable for current period
    const daySchedule = timetable[currentDay] || [];
    const currentPeriod = daySchedule.find(p => currentTime >= p.start && currentTime <= p.end);

    if (currentPeriod && currentPeriod.facultyId === state.currentTeacher.id) {
        currentClassSelect.value = currentPeriod.subject;
    }
}

function setupSocket() {
    state.socket = io();
    state.socket.on('teacher_attendance_update', (studentData) => {
        if (state.attendanceLogs.find(log => log.rollNo === studentData.id)) return;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        
        const logEntry = {
            slNo: state.presentCount + 1,
            name: studentData.name,
            rollNo: studentData.id,
            time: timeString,
            status: 'Present'
        };
        
        state.attendanceLogs.push(logEntry);
        state.presentCount++;
        addTableRow(logEntry);
        updateStats();
    });

    state.socket.on('student_stats_data', (data) => {
        const analyticsBody = document.getElementById('analyticsLogBody');
        
        // Remove "Loading" row on first response
        if(analyticsBody.innerHTML.includes("Loading")) analyticsBody.innerHTML = "";

        // Since we receive stats one by one, we'll append/update the row
        const existingRow = document.querySelector(`tr[data-usn="${data.usn}"]`);
        
        const rowHtml = `
            <td>${data.usn}</td>
            <td>${data.name || "Student"}</td>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="flex:1; height:6px; background:#1c1f26; border-radius:3px; overflow:hidden;">
                        <div style="width:${data.percentage}%; height:100%; background:${data.percentage < 75 ? '#ef4444' : '#10b981'};"></div>
                    </div>
                    <span>${data.percentage}%</span>
                </div>
            </td>
            <td style="color:${data.missedDates.length > 0 ? '#ef4444' : '#94a3b8'}">${data.missedDates.length} Classes</td>
            <td><button class="btn btn-secondary" style="padding:4px 8px; font-size:0.7rem;" onclick='alert("Missed Dates for ${data.usn}:\\n\\n${data.missedDates.join("\\n") || "None!"}")'>History</button></td>
        `;

        if (existingRow) {
            existingRow.innerHTML = rowHtml;
        } else {
            const tr = document.createElement('tr');
            tr.setAttribute('data-usn', data.usn);
            tr.innerHTML = rowHtml;
            analyticsBody.appendChild(tr);
        }
    });
    state.socket.on('history_data', (history) => {
        // Update Session History View
        const historyBody = document.getElementById('historyLogBody');
        if (historyBody) {
            historyBody.innerHTML = "";
            history.slice().reverse().forEach(session => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${session.date}</td>
                    <td>${session.subject}</td>
                    <td>${session.faculty}</td>
                    <td>${session.count} Students</td>
                    <td><button class="btn btn-secondary" style="padding:4px 8px; font-size:0.7rem;" onclick='viewSessionDetail(${JSON.stringify(session)})'>View Details</button></td>
                `;
                historyBody.appendChild(tr);
            });
        }

        // Update Matrix View
        const registerBody = document.getElementById('registerBody');
        if (registerBody) {
            buildRegisterMatrix(history);
        }
    });

    state.socket.on('update_success', () => {
        window.fetchAnalytics(); // Refresh the matrix
    });
}

window.viewSessionDetail = (session) => {
    alert(`Session Details for ${session.subject}\nDate: ${session.date}\nTotal Present: ${session.count}\n\nStudents: ${session.logs.map(l => l.name).join(", ")}`);
};

function setupEventListeners() {
    toggleBeaconBtn.onclick = toggleBeacon;

    // Reset attendance data when the subject is changed
    currentClassSelect.onchange = () => {
        if (state.isBroadcasting) {
            if (!confirm("Broadcasting is active! Changing the subject will stop the current session. Continue?")) {
                return;
            }
            toggleBeacon(); 
        }
        // Save current session before resetting if there are logs
        if (state.attendanceLogs.length > 0) {
            saveCurrentSession();
        }
        resetAttendanceSession();
    };

    // Navigation logic (Live / History switching)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
            document.getElementById(`view-${view}`).style.display = 'grid';

            if (view === 'history') window.fetchHistory();
            if (view === 'analytics') window.fetchAnalytics();
        };
    });

    // Logout logic
    document.getElementById('logoutBtn').onclick = () => {
        if (state.attendanceLogs.length > 0) {
            saveCurrentSession();
        }
        location.href = '/index.html';
    };
}

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

window.fetchAnalytics = () => {
    state.socket.emit('get_history'); 
};

function buildRegisterMatrix(history) {
    const filter = document.getElementById('analyticsSubjectFilter');
    const selectedSubject = filter.value;
    
    // 1. Populate Subject Filter if empty
    if (filter.options.length === 1) {
        const uniqueSubjects = [...new Set(history.map(h => h.subject))];
        uniqueSubjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            filter.appendChild(opt);
        });
        
        filter.onchange = () => buildRegisterMatrix(history);
    }

    const head = document.getElementById('registerHead');
    const body = document.getElementById('registerBody');
    
    // 2. Filter history based on subject
    const filteredHistory = selectedSubject === "ALL" 
        ? history 
        : history.filter(h => h.subject === selectedSubject);

    // 3. Identify unique sessions (date + subject for uniqueness)
    const sessionDates = [];
    const seenSessions = new Set();
    filteredHistory.forEach(s => {
        const key = `${s.date}`; // Group by date
        if (!seenSessions.has(key)) {
            sessionDates.push({ date: s.date, subject: s.subject });
            seenSessions.add(key);
        }
    });
    
    // 4. Build Headers
    let headerHtml = `
        <tr>
            <th class="student-cell">Sl No. Student Name</th>
            <th>USN No.</th>
            <th>Total</th>
            <th>Present</th>
            <th>%</th>
    `;
    
    sessionDates.forEach(s => {
        const parts = s.date.split('/');
        const monthName = parts.length > 1 ? new Date(2026, parts[0]-1).toLocaleString('default', { month: 'short' }) : "???";
        const day = parts.length > 1 ? parts[1] : s.date;
        headerHtml += `
            <th title="${s.subject}">
                <div class="date-header">
                    <span class="month">${monthName}</span>
                    <span class="day">${day}</span>
                </div>
            </th>
        `;
    });
    headerHtml += "</tr>";
    head.innerHTML = headerHtml;

    // 5. Build Rows
    body.innerHTML = "";
    studentDb.forEach((student, index) => {
        let attendedCount = 0;
        let ncCount = 0;
        let cellsHtml = "";

        sessionDates.forEach(session => {
            // Find all session data for this date and check if student was present in ANY of them
            const dailySessions = filteredHistory.filter(h => h.date === session.date);
            let status = "A";

            for (const sess of dailySessions) {
                const log = sess.logs.find(l => l.rollNo === student.id);
                if (log) {
                    if (log.status === "P" || log.status === "Present") {
                        status = "P";
                        break; 
                    } else if (log.status === "NC") {
                        status = "NC";
                    }
                }
            }
            
            if (status === "P") {
                attendedCount++;
                cellsHtml += `<td class="status-cell p-status" onclick="editStatus('${session.date}', '${session.subject}', '${student.id}', 'P')">P</td>`;
            } else if (status === "NC") {
                ncCount++;
                cellsHtml += `<td class="status-cell nc-status" onclick="editStatus('${session.date}', '${session.subject}', '${student.id}', 'NC')">NC</td>`;
            } else {
                cellsHtml += `<td class="status-cell a-status" onclick="editStatus('${session.date}', '${session.subject}', '${student.id}', 'A')">A</td>`;
            }
        });

        // Percentage Calculation: Present / (Total - NC)
        const totalEligible = sessionDates.length - ncCount;
        const perc = totalEligible > 0 ? ((attendedCount / totalEligible) * 100).toFixed(0) : 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="student-cell">${index + 1}. ${student.name}</td>
            <td>${student.id}</td>
            <td>${sessionDates.length}</td>
            <td>${attendedCount}</td>
            <td style="color: ${perc < 75 ? '#ef4444' : '#10b981'}">${perc}%</td>
            ${cellsHtml}
        `;
        body.appendChild(tr);
    });
}

window.editStatus = (date, subject, usn, current) => {
    const newStatus = prompt(`Change attendance for ${usn} on ${date}?\nEnter P for Present, A for Absent, or NC for Not Conducted:`, current);
    if (newStatus && newStatus.toUpperCase() !== current) {
        state.socket.emit('update_attendance', { 
            date, 
            subject, 
            usn, 
            newStatus: newStatus.toUpperCase() 
        });
    }
};

function saveCurrentSession() {
    if (state.attendanceLogs.length === 0) return;
    const sessionData = {
        date: new Date().toLocaleDateString(),
        subject: currentClassSelect.value,
        faculty: state.currentTeacher.name,
        count: state.presentCount,
        logs: state.attendanceLogs
    };
    state.socket.emit('save_session', sessionData);
}

window.fetchHistory = () => {
    state.socket.emit('get_history');
};

function resetAttendanceSession() {
    state.attendanceLogs = [];
    state.presentCount = 0;
    liveLogBody.innerHTML = ""; // Clear table
    updateStats(); // Reset stats and chart
}

function toggleBeacon() {
    state.isBroadcasting = !state.isBroadcasting;
    if (state.isBroadcasting) {
        toggleBeaconBtn.textContent = "Stop Broadcast";
        toggleBeaconBtn.classList.add('broadcasting');
        beaconStatusText.textContent = "Beacon Active...";
        pulseRing.classList.add('active');
        
        if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Triple-Tone Power Blast for 20m range
        const frequencies = [18200, 18500, 18800];
        state.oscillators = frequencies.map(freq => {
            const osc = state.audioCtx.createOscillator();
            const gain = state.audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, state.audioCtx.currentTime);
            
            // Boost gain to max
            gain.gain.setValueAtTime(0.8, state.audioCtx.currentTime); 
            
            osc.connect(gain);
            gain.connect(state.audioCtx.destination);
            osc.start();
            return osc;
        });
        
        state.socket.emit('teacher_toggle_broadcast', true);
    } else {
        toggleBeaconBtn.textContent = "Start Broadcast";
        toggleBeaconBtn.classList.remove('broadcasting');
        beaconStatusText.textContent = "Beacon Offline";
        pulseRing.classList.remove('active');
        if (state.oscillators) {
            state.oscillators.forEach(osc => { osc.stop(); osc.disconnect(); });
            state.oscillators = null;
        }
        state.socket.emit('teacher_toggle_broadcast', false);
    }
}

function initChart() {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    state.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Absent'],
            datasets: [{
                data: [0, 28],
                backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%' }
    });
}

function updateStats() {
    presentCountEl.innerText = state.presentCount;
    absentCountEl.innerText = state.enrolled - state.presentCount;
    state.chart.data.datasets[0].data = [state.presentCount, state.enrolled - state.presentCount];
    state.chart.update();
}

function addTableRow(log) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${log.slNo}</td><td>${log.name}</td><td>${log.rollNo}</td><td>${log.time}</td><td><span class="status-badge present">Present</span></td>`;
    liveLogBody.insertBefore(tr, liveLogBody.firstChild);
}

// Global Exports
window.exportData = (format) => {
    if (state.attendanceLogs.length === 0) return alert("No data");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const className = currentClassSelect.value;
    doc.text(`Attendance Report - ${className}`, 14, 20);
    state.attendanceLogs.forEach((l, i) => doc.text(`${l.rollNo} - ${l.name}`, 14, 30 + (i * 10)));
    doc.save(`Attendance_${className}.pdf`);
};

document.addEventListener('DOMContentLoaded', init);
