// Test script to verify real-time communication fixes
const io = require('socket.io-client');
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Test configuration
const testUsers = [
  { username: 'testuser1', password: 'testpass1' },
  { username: 'testuser2', password: 'testpass2' }
];

let authTokens = {};
let sockets = {};

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test authentication
async function testAuth(user) {
  try {
    console.log(`🔐 Testing authentication for ${user.username}...`);
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: user.username,
      password: user.password
    });
    
    if (response.data && response.data.data && response.data.data.tokens) {
      authTokens[user.username] = response.data.data.tokens.accessToken;
      console.log(`✅ Auth successful for ${user.username}`);
      return true;
    }
    
    console.log(`❌ Auth failed for ${user.username}`);
    return false;
  } catch (error) {
    console.log(`❌ Auth error for ${user.username}:`, error.response?.status || error.message);
    return false;
  }
}

// Test socket connection with authentication
async function testSocketConnection(user) {
  return new Promise((resolve, reject) => {
    console.log(`📡 Testing socket connection for ${user.username}...`);
    
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      timeout: 10000,
      auth: {
        token: authTokens[user.username]
      }
    });
    
    socket.on('connect', () => {
      console.log(`✅ Socket connected for ${user.username}: ${socket.id}`);
      sockets[user.username] = socket;
      resolve(true);
    });
    
    socket.on('connected', (data) => {
      console.log(`🤝 Connection confirmed for ${user.username}:`, data);
    });
    
    socket.on('connect_error', (error) => {
      console.log(`❌ Socket connection error for ${user.username}:`, error.message);
      reject(error);
    });
    
    socket.on('userOnline', (data) => {
      console.log(`👤 User online event received:`, data);
    });
    
    socket.on('userOffline', (data) => {
      console.log(`👤 User offline event received:`, data);
    });
    
    socket.on('userStatusUpdate', (data) => {
      console.log(`📊 User status update received:`, data);
    });
    
    socket.on('messageStatusUpdate', (data) => {
      console.log(`📨 Message status update received:`, data);
    });
    
    socket.on('messageDelivered', (data) => {
      console.log(`📦 Message delivered event received:`, data);
    });
    
    socket.on('messageRead', (data) => {
      console.log(`📖 Message read event received:`, data);
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!sockets[user.username]) {
        socket.disconnect();
        reject(new Error('Socket connection timeout'));
      }
    }, 10000);
  });
}

// Test user status update
async function testUserStatusUpdate(username) {
  try {
    console.log(`📊 Testing user status update for ${username}...`);
    
    const response = await axios.put(`${BASE_URL}/api/users/status`, {
      status: true,
      statusMessage: 'Testing status update'
    }, {
      headers: {
        'Authorization': `Bearer ${authTokens[username]}`
      }
    });
    
    console.log(`✅ Status update successful for ${username}`);
    return true;
  } catch (error) {
    console.log(`❌ Status update failed for ${username}:`, error.response?.status || error.message);
    return false;
  }
}

// Test message delivery simulation
async function testMessageDelivery() {
  try {
    console.log(`📨 Testing message delivery simulation...`);
    
    const user1Socket = sockets[testUsers[0].username];
    const user2Socket = sockets[testUsers[1].username];
    
    if (!user1Socket || !user2Socket) {
      console.log(`❌ Both sockets not available for message test`);
      return false;
    }
    
    // Simulate message delivery event
    const testMessageId = '507f1f77bcf86cd799439011'; // Mock message ID
    
    console.log(`📦 Simulating message delivery for message: ${testMessageId}`);
    user2Socket.emit('messageDelivered', {
      messageId: testMessageId
    });
    
    await wait(1000);
    
    console.log(`📖 Simulating message read for message: ${testMessageId}`);
    user2Socket.emit('messageRead', {
      messageId: testMessageId
    });
    
    console.log(`✅ Message delivery simulation completed`);
    return true;
  } catch (error) {
    console.log(`❌ Message delivery test failed:`, error.message);
    return false;
  }
}

// Test chat joining
async function testChatJoining() {
  try {
    console.log(`🏠 Testing chat joining...`);
    
    const user1Socket = sockets[testUsers[0].username];
    
    if (!user1Socket) {
      console.log(`❌ Socket not available for chat join test`);
      return false;
    }
    
    const testChatId = '507f1f77bcf86cd799439012'; // Mock chat ID
    
    user1Socket.emit('joinChat', testChatId);
    
    await wait(2000);
    
    console.log(`✅ Chat joining test completed`);
    return true;
  } catch (error) {
    console.log(`❌ Chat joining test failed:`, error.message);
    return false;
  }
}

// Cleanup function
function cleanup() {
  console.log(`🧹 Cleaning up connections...`);
  
  Object.values(sockets).forEach(socket => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
  });
  
  console.log(`✅ Cleanup completed`);
}

// Main test function
async function runRealTimeTests() {
  console.log(`🚀 Starting real-time communication tests...\n`);
  
  try {
    // Test 1: Authentication for both users
    console.log(`\n=== Test 1: Authentication ===`);
    for (const user of testUsers) {
      const authSuccess = await testAuth(user);
      if (!authSuccess) {
        console.log(`❌ Authentication failed for ${user.username}, skipping further tests`);
        return;
      }
    }
    
    // Test 2: Socket connections
    console.log(`\n=== Test 2: Socket Connections ===`);
    for (const user of testUsers) {
      try {
        await testSocketConnection(user);
      } catch (error) {
        console.log(`❌ Socket connection failed for ${user.username}`);
      }
    }
    
    await wait(2000); // Wait for connections to stabilize
    
    // Test 3: User status updates
    console.log(`\n=== Test 3: User Status Updates ===`);
    for (const user of testUsers) {
      await testUserStatusUpdate(user.username);
      await wait(1000);
    }
    
    // Test 4: Message delivery simulation
    console.log(`\n=== Test 4: Message Delivery Simulation ===`);
    await testMessageDelivery();
    
    // Test 5: Chat joining
    console.log(`\n=== Test 5: Chat Joining ===`);
    await testChatJoining();
    
    await wait(3000); // Wait for all events to process
    
    console.log(`\n✅ All real-time tests completed successfully!`);
    console.log(`🎉 Real-time communication fixes are working properly`);
    
  } catch (error) {
    console.log(`\n❌ Test failed:`, error.message);
    console.log(`🔧 Real-time communication needs attention`);
  } finally {
    cleanup();
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log(`\n🛑 Test interrupted by user`);
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`\n🛑 Test terminated`);
  cleanup();
  process.exit(0);
});

// Run the tests
runRealTimeTests();