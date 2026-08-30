#!/bin/bash
echo "============================================================"
echo "  🎯  Sistem Presensi Pegawai — Development Mode"
echo "============================================================"
echo ""
echo "Starting Frontend (React) on http://localhost:5173"
echo "Starting Backend  (Flask)  on http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop both servers."
echo "============================================================"
echo ""

# Start Flask backend in background
cd server && python app.py &
FLASK_PID=$!

# Wait a moment then start frontend
sleep 2
echo "Starting React frontend..."
npm run dev

# When frontend stops, kill backend
kill $FLASK_PID 2>/dev/null
