// Test script to verify the fixes for notifications, read receipts, and status
const io = require('socket.io-client');
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Test data
const testUsers = [
  { username: 'user1', password: 'password123' },
  { username: 'user2', password: 'password123' }
];

let tokens = {};
let sockets = {};

// Helper function to login and get token
async function loginUser(username, password) {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      userId: username,
      password: password
    });
    return response.data.data.tokens.accessToken;
  } catch (error) {
    console.log(`❌ Login failed for ${username}:`, error.response?.data?.message || error.message);
    return null;
  }
}

// Helper function to create socket connection
function createSocket(token, username) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      auth: { token },
      timeout: 5000
    });

    socket.on('connect', () => {
      console.log(`✅ ${username} connected with socket ID: ${socket.id}`);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      console.log(`❌ ${username} connection error:`, error.message);
      reject(error);
    });

    // Listen for status updates
    socket.on('userOnline', (data) => {
      console.log(`🟢 ${username} received userOnline:`, data);
    });

    socket.on('userOffline', (data) => {
      console.log(`🔴 ${username} received userOffline:`, data);
    });

    socket.on('userStatusUpdate', (data) => {
      console.log(`📊 ${username} received userStatusUpdate:`, data);
    });

    // Listen for message events
    socket.on('messageReceived', (data) => {
      console.log(`📨 ${username} received message:`, data);
    });

    socket.on('messageRead', (data) => {
      console.log(`👁️ ${username} received messageRead:`, data);
    });

    socket.on('messageStatusUpdate', (data) => {
      console.log(`📊 ${username} received messageStatusUpdate:`, data);
    });

    setTimeout(() => {
      reject(new Error('Socket connection timeout'));
    }, 5000);
  });
}

// Test status update
async function testStatusUpdate(token, username) {
  try {
    console.log(`\n🔄 Testing status update for ${username}...`);
    
    const response = await axios.put(`${BASE_URL}/api/users/status`, {
      status: false,
      statusMessage: 'Away'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`✅ Status update successful for ${username}:`, response.data.message);
    return true;
  } catch (error) {
    console.log(`❌ Status update failed for ${username}:`, error.response?.data?.message || error.message);
    return false;
  }
}

// Test message sending (requires chat setup)
async function testMessageSending(token, chatId, content) {
  try {
    console.log(`\n📤 Testing message sending to chat ${chatId}...`);
    
    const response = await axios.post(`${BASE_URL}/api/messages/${chatId}`, {
      content: content
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`✅ Message sent successfully:`, response.data.message);
    return response.data.data;
  } catch (error) {
    console.log(`❌ Message sending failed:`, error.response?.data?.message || error.message);
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting comprehensive tests for fixes...\n');

  try {
    // Step 1: Login users
    console.log('📝 Step 1: Logging in test users...');
    for (const user of testUsers) {
      const token = await loginUser(user.username, user.password);
      if (token) {
        tokens[user.username] = token;
        console.log(`✅ ${user.username} logged in successfully`);
      }
    }

    if (Object.keys(tokens).length === 0) {
      console.log('❌ No users could log in. Please ensure test users exist.');
      return;
    }

    // Step 2: Create socket connections
    console.log('\n📡 Step 2: Creating socket connections...');
    for (const [username, token] of Object.entries(tokens)) {
      try {
        const socket = await createSocket(token, username);
        sockets[username] = socket;
      } catch (error) {
        console.log(`❌ Failed to connect ${username}`);
      }
    }

    // Wait a bit for connections to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Test status updates
    console.log('\n📊 Step 3: Testing status updates...');
    for (const [username, token] of Object.entries(tokens)) {
      await testStatusUpdate(token, username);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 4: Test message read events (if we have sockets)
    if (Object.keys(sockets).length >= 2) {
      console.log('\n👁️ Step 4: Testing message read events...');
      const usernames = Object.keys(sockets);
      const socket1 = sockets[usernames[0]];
      const socket2 = sockets[usernames[1]];

      // Simulate message read event
      socket1.emit('messageRead', {
        messageId: 'test-message-id-123',
        chatId: 'test-chat-id-456'
      });

      console.log(`📖 ${usernames[0]} sent message read event`);
    }

    // Wait for events to process
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n✅ All tests completed!');
    console.log('\n📋 Summary:');
    console.log(`- Logged in users: ${Object.keys(tokens).length}`);
    console.log(`- Connected sockets: ${Object.keys(sockets).length}`);
    console.log('- Status updates: Tested');
    console.log('- Socket events: Monitored');

  } catch (error) {
    console.log('\n❌ Test failed:', error.message);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up connections...');
    for (const socket of Object.values(sockets)) {
      socket.disconnect();
    }
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted. Cleaning up...');
  for (const socket of Object.values(sockets)) {
    socket.disconnect();
  }
  process.exit(0);
});

runTests();