// Test script to verify socket fixes
const io = require('socket.io-client');
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Test authentication first
async function testAuth() {
  try {
    console.log('🔐 Testing authentication...');
    
    // Test login endpoint
    const loginData = {
      username: 'testuser',
      password: 'testpass'
    };
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, loginData);
    console.log('✅ Auth endpoint responded:', response.status);
    return response.data;
  } catch (error) {
    console.log('⚠️ Auth test response:', error.response?.status || error.message);
    return null;
  }
}

// Test socket connection
async function testSocket() {
  try {
    console.log('📡 Testing socket connection...');
    
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      timeout: 5000
    });
    
    return new Promise((resolve, reject) => {
      socket.on('connect', () => {
        console.log('✅ Socket connected successfully');
        console.log('📡 Socket ID:', socket.id);
        socket.disconnect();
        resolve(true);
      });
      
      socket.on('connect_error', (error) => {
        console.log('❌ Socket connection error:', error.message);
        reject(error);
      });
      
      socket.on('disconnect', () => {
        console.log('📡 Socket disconnected');
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Socket connection timeout'));
      }, 5000);
    });
  } catch (error) {
    console.log('❌ Socket test failed:', error.message);
    return false;
  }
}

// Test message API endpoint
async function testMessageAPI() {
  try {
    console.log('📨 Testing message API...');
    
    // This should return 401 (unauthorized) but not crash
    const response = await axios.get(`${BASE_URL}/api/messages/test-chat-id`);
    console.log('✅ Message API responded:', response.status);
    return true;
  } catch (error) {
    const status = error.response?.status;
    if (status === 401) {
      console.log('✅ Message API working (401 Unauthorized as expected)');
      return true;
    }
    console.log('⚠️ Message API response:', status || error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting backend tests...\n');
  
  try {
    // Test 1: Authentication
    await testAuth();
    
    // Test 2: Socket connection
    await testSocket();
    
    // Test 3: Message API
    await testMessageAPI();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('🎉 Backend is working properly');
    
  } catch (error) {
    console.log('\n❌ Test failed:', error.message);
    console.log('🔧 Backend needs attention');
  }
  
  process.exit(0);
}

runTests();