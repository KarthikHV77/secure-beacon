// State Management
const state = {
    isBroadcasting: false,
    enrolled: 28,
    presentCount: 0,
    students: [],
    attendanceLogs: [],
    chart: null,
    audioCtx: null,
    oscillator: null,
    socket: null
};

// DOM Elements
const toggleBeaconBtn = document.getElementById('toggleBeaconBtn');
const beaconStatusText = document.getElementById('beaconStatusText');
const pulseRing = document.querySelector('.pulse-ring');
const presentCountEl = document.getElementById('presentCount');
const absentCountEl = document.getElementById('absentCount');
const liveLogBody = document.getElementById('liveLogBody');

// Initialize Dashboard
function init() {
    initChart();
    setupEventListeners();
    setupSocket();
}

function setupSocket() {
    state.socket = io(); // Connect to local node server

    // Listen for real student attendance events!
    state.socket.on('teacher_attendance_update', (studentData) => {
        // Prevent duplicate check-ins
        if (state.attendanceLogs.find(log => log.rollNo === studentData.id)) {
            return;
        }

        const now = new Date();
        const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        
        const logEntry = {
            slNo: state.presentCount + 1,
            name: studentData.name,
            rollNo: studentData.id,
            time: timeString,
            rssi: studentData.rssi || "-45", // Mocked RSSI for the UI
            status: 'Present'
        };
        
        state.attendanceLogs.push(logEntry);
        state.presentCount++;
        
        addTableRow(logEntry);
        updateStats();
    });
}

function setupEventListeners() {
    toggleBeaconBtn.addEventListener('click', toggleBeacon);
}

function initChart() {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    
    const presentGradient = ctx.createLinearGradient(0, 0, 0, 400);
    presentGradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
    presentGradient.addColorStop(1, 'rgba(16, 185, 129, 0.2)');

    const absentGradient = ctx.createLinearGradient(0, 0, 0, 400);
    absentGradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
    absentGradient.addColorStop(1, 'rgba(239, 68, 68, 0.2)');

    state.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Absent'],
            datasets: [{
                data: [state.presentCount, state.enrolled - state.presentCount],
                backgroundColor: [presentGradient, absentGradient],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#f0f0f5', font: { family: 'Inter', size: 12 } } }
            }
        }
    });
}

function updateStats() {
    presentCountEl.innerText = state.presentCount;
    absentCountEl.innerText = state.enrolled - state.presentCount;
    state.chart.data.datasets[0].data = [state.presentCount, state.enrolled - state.presentCount];
    state.chart.update();
}

function toggleBeacon() {
    state.isBroadcasting = !state.isBroadcasting;
    
    if (state.isBroadcasting) {
        toggleBeaconBtn.textContent = "Stop Broadcast";
        toggleBeaconBtn.classList.add('broadcasting');
        beaconStatusText.textContent = "Beacon Active (Broadcasting...)";
        pulseRing.classList.add('active');
        
        // --- ULTRASONIC EMISSION ---
        if (!state.audioCtx) {
            state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        state.oscillator = state.audioCtx.createOscillator();
        state.oscillator.type = 'sine';
        state.oscillator.frequency.setValueAtTime(17500, state.audioCtx.currentTime); 
        state.oscillator.connect(state.audioCtx.destination);
        state.oscillator.start();
        console.log("[Ultrasonic] Broadcasting at 17.5kHz...");

        // Notify Server
        state.socket.emit('teacher_toggle_broadcast', true);
    } else {
        toggleBeaconBtn.textContent = "Start Broadcast";
        toggleBeaconBtn.classList.remove('broadcasting');
        beaconStatusText.textContent = "Beacon Offline";
        pulseRing.classList.remove('active');
        
        // --- STOP EMISSION ---
        if (state.oscillator) {
            state.oscillator.stop();
            state.oscillator.disconnect();
            console.log("[Ultrasonic] Broadcast stopped.");
        }

        // Notify Server
        state.socket.emit('teacher_toggle_broadcast', false);
    }
}

function addTableRow(log) {
    const tr = document.createElement('tr');
    tr.className = 'new-row';
    tr.innerHTML = `
        <td>${log.slNo}</td>
        <td><strong>${log.name}</strong></td>
        <td>${log.rollNo}</td>
        <td>${log.time}</td>
        <td style="color: #94a3b8">${log.rssi} dBm</td>
        <td><span class="status-badge present">Present</span></td>
    `;
    liveLogBody.insertBefore(tr, liveLogBody.firstChild);
}

// EXPORT FUNCTIONS (Task 3: One-Click PDF/Excel Export)
window.exportData = function(format) {
    if (state.attendanceLogs.length === 0) {
        alert("No attendance data to export.");
        return;
    }
    if (format === 'pdf') exportToPDF();
    else if (format === 'excel') exportToExcel();
};

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const className = document.getElementById('currentClass').options[document.getElementById('currentClass').selectedIndex].text;
    const dateStr = new Date().toLocaleDateString();

    doc.setFontSize(18);
    doc.text("College Name - Attendance Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Department: MCA`, 14, 30);
    doc.text(`Subject: ${className}`, 14, 36);
    doc.text(`Teacher: Prof. Karthik`, 14, 42);
    doc.text(`Date: ${dateStr}`, 14, 48);
    doc.text(`Total Present: ${state.presentCount} / ${state.enrolled}`, 14, 56);

    let yPos = 70;
    doc.setFont("helvetica", "bold");
    doc.text("Sl No", 14, yPos);
    doc.text("Student Name", 30, yPos);
    doc.text("Roll No", 100, yPos);
    doc.text("Time", 160, yPos);
    doc.line(14, yPos + 2, 196, yPos + 2);
    yPos += 10;
    
    doc.setFont("helvetica", "normal");
    const sortedLogs = [...state.attendanceLogs].sort((a,b) => a.slNo - b.slNo);

    sortedLogs.forEach(log => {
        if (yPos > 280) { doc.addPage(); yPos = 20; }
        doc.text(log.slNo.toString(), 14, yPos);
        doc.text(log.name, 30, yPos);
        doc.text(log.rollNo, 100, yPos);
        doc.text(log.time, 160, yPos);
        yPos += 8;
    });
    doc.save(`Attendance_${dateStr.replace(/\//g, '-')}.pdf`);
}

function exportToExcel() {
    const className = document.getElementById('currentClass').options[document.getElementById('currentClass').selectedIndex].text;
    const dateStr = new Date().toLocaleDateString();
    const excelData = state.attendanceLogs.map(log => ({
        "Sl No": log.slNo,
        "Student Name": log.name,
        "Roll No": log.rollNo,
        "Time of Entry": log.time,
        "Status": log.status
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.sheet_add_aoa(ws, [ ["College Name - Attendance Report"], [`Subject: ${className}`], [`Date: ${dateStr}`], [] ], { origin: "A1" });
    XLSX.utils.sheet_add_json(ws, excelData, { origin: "A5", skipHeader: false });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `Attendance_${dateStr.replace(/\//g, '-')}.xlsx`);
}

document.addEventListener('DOMContentLoaded', init);
