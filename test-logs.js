#!/usr/bin/env node

const https = require('https');

// Test the GitHub API directly to understand the response
function testGitHubAPI() {
  console.log('Testing GitHub API for job logs...\n');

  const options = {
    hostname: 'api.github.com',
    path: '/repos/manojkmfsi/monodog/actions/jobs/63425173619/logs',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer dummy-token', // Using dummy to test error handling
      'User-Agent': 'MonoDog',
      'Accept': 'application/vnd.github.raw',
    },
  };

  const request = https.request(options, (response) => {
    let body = '';
    console.log(`Status: ${response.statusCode}`);
    console.log('Headers:');
    Object.entries(response.headers).forEach(([key, value]) => {
      if (key.startsWith('x-') || key === 'content-type' || key === 'location') {
        console.log(`  ${key}: ${value}`);
      }
    });
    console.log('');

    response.on('data', (chunk) => {
      body += chunk;
    });

    response.on('end', () => {
      console.log(`Response Body (${body.length} chars):`);
      console.log(body);
      console.log('\n');
    });
  });

  request.on('error', (error) => {
    console.error('Request error:', error.message);
  });

  request.end();
}

// Test with valid auth header to see actual response
function testWithoutAuth() {
  console.log('Testing GitHub API without auth header...\n');

  const options = {
    hostname: 'api.github.com',
    path: '/repos/manojkmfsi/monodog/actions/jobs/63425173619/logs',
    method: 'GET',
    headers: {
      'User-Agent': 'MonoDog',
      'Accept': 'application/vnd.github.raw',
    },
  };

  const request = https.request(options, (response) => {
    let body = '';
    console.log(`Status: ${response.statusCode}`);
    console.log('Headers:');
    Object.entries(response.headers).forEach(([key, value]) => {
      if (key.startsWith('x-') || key === 'content-type' || key === 'location') {
        console.log(`  ${key}: ${value}`);
      }
    });
    console.log('');

    response.on('data', (chunk) => {
      body += chunk;
    });

    response.on('end', () => {
      console.log(`Response Body (${body.length} chars):`);
      console.log(body);
      console.log('\n');
    });
  });

  request.on('error', (error) => {
    console.error('Request error:', error.message);
  });

  request.end();
}

console.log('='.repeat(60));
console.log('GitHub API Direct Tests');
console.log('='.repeat(60));
console.log('');

testGitHubAPI();
setTimeout(() => {
  testWithoutAuth();
}, 1000);
