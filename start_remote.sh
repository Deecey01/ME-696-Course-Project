#!/bin/bash

# Simple script to launch ngrok and start the backend proxy
# Assumes ngrok is installed and authenticated.

echo "Starting Ngrok on Port 8002..."
echo "Please copy the public URL provided by Ngrok and enter it in the mobile app."

ngrok http 8002
