#!/usr/bin/env node
/**
 * Fetches data from the running local server and saves it as a static JSON snapshot.
 * Usage: Start the server first (npm start), then run: node snapshot.js
 */
const fs = require('fs');
const path = require('path');

async function main() {
  let data;
  try {
    const res = await fetch('http://localhost:3000/api/data');
    data = await res.json();
    if (data.error) throw new Error(data.error);
  } catch (e) {
    console.error('Could not fetch from local server:', e.message);
    console.error('Start the server first: npm start');
    process.exit(1);
  }

  const outPath = path.join(__dirname, 'docs', 'data.json');
  fs.writeFileSync(outPath, JSON.stringify(data));
  console.log(`Snapshot saved: docs/data.json (${data.issues.length} issues)`);
}

main();
