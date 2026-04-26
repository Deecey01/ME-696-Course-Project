#!/bin/bash

if [ ! -f .pids ]; then
    echo "No .pids file found. Are the services running?"
    echo "Attempting to kill node and python processes on expected ports..."
    lsof -ti:8000,8001,8002,5173 | xargs kill -9 2>/dev/null
    echo "Done."
    exit 0
fi

echo "Stopping Smart Vest Ecosystem..."

while read PID; do
    if ps -p $PID > /dev/null; then
        echo "Killing process $PID..."
        kill -9 $PID
    fi
done < .pids

# Also cleanup any child processes that might have spawned (like uvicorn workers or vite)
lsof -ti:8000,8001,8002,5173,5174 | xargs kill -9 2>/dev/null

rm .pids
echo "✅ All services stopped."
