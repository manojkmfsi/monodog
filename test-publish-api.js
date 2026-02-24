#!/usr/bin/env node

const http = require('http');

// For testing, create a mock auth token
// In real usage, this would come from actual authentication
const mockToken = 'test-token-' + Date.now();

// First, let's create a fake session in the backend
// This requires the backend to have a way to set sessions
// For now, we'll just test the endpoint

const API_BASE = 'http://localhost:8999';

async function testPublish() {
  console.log('=== Testing Publish Pipeline Creation ===\n');

  // Step 1: Check current pipelines
  console.log('Step 1: Checking current pipelines...');
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request(API_BASE + '/api/pipelines', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }));
      });
      req.on('error', reject);
      req.end();
    });
    
    console.log(`Status: ${response.status}`);
    console.log(`Existing pipelines: ${response.data.length || 0}\n`);
  } catch (err) {
    console.error('Error checking pipelines:', err.message);
  }

  // Step 2: Trigger publish
  console.log('Step 2: Triggering publish...');
  const publishBody = JSON.stringify({
    packages: ['@manojkmfsi/monodog'],
  });

  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request(API_BASE + '/api/publish/trigger', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(publishBody),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data: { error: data } });
          }
        });
      });
      req.on('error', reject);
      req.write(publishBody);
      req.end();
    });

    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('Error triggering publish:', err.message);
  }

  // Step 3: Check pipelines again
  console.log('\nStep 3: Checking pipelines after publish...');
  setTimeout(async () => {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = http.request(API_BASE + '/api/pipelines', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          },
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }));
        });
        req.on('error', reject);
        req.end();
      });

      console.log(`Status: ${response.status}`);
      if (Array.isArray(response.data)) {
        console.log(`Pipelines found: ${response.data.length}`);
        response.data.forEach(p => {
          console.log(`  - ${p.packageName} v${p.releaseVersion} (${p.currentStatus})`);
        });
      } else {
        console.log('Response:', response.data);
      }
    } catch (err) {
      console.error('Error checking pipelines:', err.message);
    }
  }, 1000);
}

testPublish().catch(console.error);
