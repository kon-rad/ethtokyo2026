#!/bin/bash
# door-demo.sh — Trigger the AI City door latch for a demo
#
# Usage:
#   ./door-demo.sh [open_seconds]
#
# Default open time is 5 seconds. Pass a number to change it:
#   ./door-demo.sh 10   # open for 10 seconds

set -euo pipefail

DOOR="sudo /opt/aicity-door/venv/bin/python /opt/aicity-door/pi4-door.py"
OPEN="${1:-5}"

echo "=== Door demo ==="
echo "Open for ${OPEN}s, then close."
echo ""

$DOOR open
echo "Door open. Waiting ${OPEN}s..."
sleep "$OPEN"
$DOOR close
echo "Door closed."

# Also do a quick second cycle to show it works both ways
sleep 1
echo ""
echo "--- Second cycle ---"
$DOOR open
sleep 2
$DOOR close
echo "=== Demo complete ==="