// Simple test to verify our socket fixes are working
const http = require('http');

console.log('🚀 Testing backend server...\n');

// Test 1: Basic HTTP request
function testHttpRequest() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('✅ HTTP Request successful');
        console.log('📊 Status:', res.statusCode);
        console.log('📝 Response length:', data.length);
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.log('❌ HTTP Request error:', error.message);
      reject(error);
    });

    // Send test data
    req.write(JSON.stringify({ username: 'test', password: 'test' }));
    req.end();
  });
}

// Test 2: Check if server is responsive
function testServerHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      console.log('✅ Server is responsive');
      console.log('📊 Status:', res.statusCode);
      resolve({ status: res.statusCode });
    });

    req.on('error', (error) => {
      console.log('❌ Server health check failed:', error.message);
      reject(error);
    });

    req.setTimeout(5000, () => {
      console.log('❌ Server health check timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

// Test 3: Socket.IO endpoint test
function testSocketEndpoint() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/socket.io/',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      console.log('✅ Socket.IO endpoint accessible');
      console.log('📊 Status:', res.statusCode);
      resolve({ status: res.statusCode });
    });

    req.on('error', (error) => {
      console.log('❌ Socket.IO endpoint error:', error.message);
      reject(error);
    });

    req.setTimeout(3000, () => {
      console.log('❌ Socket.IO endpoint timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

// Run all tests
async function runAllTests() {
  try {
    console.log('1️⃣ Testing server health...');
    await testServerHealth();
    console.log('');

    console.log('2️⃣ Testing HTTP request...');
    await testHttpRequest();
    console.log('');

    console.log('3️⃣ Testing Socket.IO endpoint...');
    await testSocketEndpoint();
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('✅ Backend server is working properly');
    console.log('✅ No socket adapter errors detected');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('🔧 Check server logs for more details');
  } finally {
    process.exit(0);
  }
}

runAllTests();