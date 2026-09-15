#!/bin/bash
# Fetch the latest version. Your data folder is not touched.
set -e
cd "$(dirname "$0")"
git pull
npm install
npm run build
echo "Done. Start the journal with ./start-journal.sh"
