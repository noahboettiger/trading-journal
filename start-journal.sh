#!/bin/bash
# Double-click launcher for macOS and Linux.
set -e
cd "$(dirname "$0")"

[ -d node_modules ] || { echo "First run: installing dependencies..."; npm install; }
[ -d dist ] || { echo "Building the app..."; npm run build; }

export JOURNAL_OPEN_BROWSER=1
npm start
