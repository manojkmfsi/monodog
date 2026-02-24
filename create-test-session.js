/**
 * Create a test session token for development
 * This helps test APIs without OAuth
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8999,
  path: '/api/auth/login',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response status:', res.statusCode);
    console.log('Response body:', data);
    
    // Check for redirect
    if (res.headers.location) {
      console.log('Redirects to:', res.headers.location);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.end();
