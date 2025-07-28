#!/usr/bin/env node

/**
 * Test script to verify the timestamp bug fix
 * This script simulates sending multiple messages to check if conversation ordering remains consistent
 */

const io = require('socket.io-client');
const axios = require('axios');

const SERVER_URL = 'http://localhost:5001';
const API_URL = `${SERVER_URL}/api`;

// Test users (you may need to adjust these based on your actual users)
const TEST_USERS = [
  {
    email: 'user1@example.com',
    password: 'password123'
  },
  {
    email: 'user2@example.com', 
    password: 'password123'
  }
];

let userTokens = [];
let userConnections = [];

async function loginUser(email, password) {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    
    if (response.data.success) {
      console.log(`✅ User ${email} logged in successfully`);
      return {
        token: response.data.data.accessToken,
        userId: response.data.data.user._id,
        email: email
      };
    }
  } catch (error) {
    console.log(`❌ Login failed for ${email}:`, error.response?.data?.message || error.message);
    return null;
  }
}

function connectSocket(userToken, userId, email) {
  return new Promise((resolve) => {
    const socket = io(SERVER_URL, {
      auth: {
        token: userToken
      },
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log(`🔌 Socket connected for ${email}`);
      resolve({ socket, userId, email });
    });

    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected for ${email}`);
    });

    socket.on('connect_error', (error) => {
      console.log(`❌ Socket connection error for ${email}:`, error.message);
      resolve(null);
    });
  });
}

async function getConversations(token) {
  try {
    const response = await axios.get(`${API_URL}/chat/get-all-chats`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.log('❌ Error getting conversations:', error.response?.data?.message || error.message);
    return [];
  }
}

async function sendMessage(token, chatId, content) {
  try {
    const response = await axios.post(`${API_URL}/message/send-message/${chatId}`, {
      content: content
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      console.log(`📨 Message sent: "${content}"`);
      return response.data.data;
    }
  } catch (error) {
    console.log('❌ Error sending message:', error.response?.data?.message || error.message);
    return null;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testTimestampConsistency() {
  console.log('🧪 Starting Timestamp Consistency Test...\n');

  // Login users
  console.log('👤 Logging in test users...');
  for (const user of TEST_USERS) {
    const loginResult = await loginUser(user.email, user.password);
    if (loginResult) {
      userTokens.push(loginResult);
    }
  }

  if (userTokens.length < 2) {
    console.log('❌ Need at least 2 users to test. Please ensure test users exist.');
    return;
  }

  // Connect sockets
  console.log('\n🔌 Connecting sockets...');
  for (const user of userTokens) {
    const connection = await connectSocket(user.token, user.userId, user.email);
    if (connection) {
      userConnections.push(connection);
    }
  }

  if (userConnections.length < 2) {
    console.log('❌ Failed to establish socket connections.');
    return;
  }

  console.log('\n📋 Getting initial conversations...');
  const user1 = userTokens[0];
  const initialConversations = await getConversations(user1.token);
  
  if (initialConversations.length === 0) {
    console.log('❌ No conversations found. Please ensure there are existing chats.');
    return;
  }

  const testChat = initialConversations[0];
  console.log(`🎯 Testing with chat: ${testChat.name} (ID: ${testChat._id})`);

  // Test: Send multiple messages quickly and check order
  console.log('\n🚀 Sending multiple messages to test timestamp consistency...');
  
  const messages = [
    'Message 1 - Testing timestamp consistency',
    'Message 2 - Should maintain order',
    'Message 3 - Today timestamp should not jump around',
    'Message 4 - Final test message'
  ];

  const messageSentTimes = [];

  for (let i = 0; i < messages.length; i++) {
    const startTime = Date.now();
    await sendMessage(user1.token, testChat._id, messages[i]);
    messageSentTimes.push({ message: messages[i], sentAt: startTime });
    
    // Small delay to ensure timestamp differences
    await delay(100);
  }

  // Wait a bit for all updates to propagate
  await delay(2000);

  // Check conversation order
  console.log('\n🔍 Checking conversation order after messages...');
  const finalConversations = await getConversations(user1.token);
  
  const testChatAfter = finalConversations.find(chat => chat._id === testChat._id);
  
  if (testChatAfter) {
    console.log('\n📊 Test Results:');
    console.log(`Chat Name: ${testChatAfter.name}`);
    console.log(`Last Message: ${testChatAfter.lastMessageText}`);
    console.log(`Last Message Timestamp: ${testChatAfter.lastMessageTimestamp}`);
    console.log(`Updated At: ${testChatAfter.updatedAt}`);
    
    const chatIndex = finalConversations.findIndex(chat => chat._id === testChat._id);
    console.log(`Position in conversation list: ${chatIndex + 1}/${finalConversations.length}`);
    
    if (chatIndex === 0) {
      console.log('✅ SUCCESS: Chat is at the top of the conversation list (most recent)');
    } else {
      console.log('⚠️ WARNING: Chat is not at the top. Position:', chatIndex + 1);
    }

    // Check if timestamps are consistent
    const lastMsgTime = new Date(testChatAfter.lastMessageTimestamp);
    const updatedTime = new Date(testChatAfter.updatedAt);
    const timeDiff = Math.abs(lastMsgTime.getTime() - updatedTime.getTime());
    
    if (timeDiff < 1000) { // Less than 1 second difference
      console.log('✅ SUCCESS: lastMessageTimestamp and updatedAt are consistent');
    } else {
      console.log('⚠️ WARNING: Timestamp inconsistency detected. Difference:', timeDiff, 'ms');
    }
  } else {
    console.log('❌ ERROR: Could not find test chat in final conversations');
  }

  // Print conversation order for manual verification
  console.log('\n📋 Final Conversation Order:');
  finalConversations.slice(0, 5).forEach((chat, index) => {
    const lastMsgTime = new Date(chat.lastMessageTimestamp || 0);
    const isTestChat = chat._id === testChat._id ? ' 🎯' : '';
    console.log(`${index + 1}. ${chat.name}${isTestChat}`);
    console.log(`   Last Message: ${chat.lastMessageText || 'No message'}`);
    console.log(`   Timestamp: ${lastMsgTime.toLocaleString()}`);
    console.log('');
  });

  // Cleanup
  console.log('🧹 Cleaning up connections...');
  userConnections.forEach(conn => {
    if (conn.socket) {
      conn.socket.disconnect();
    }
  });

  console.log('\n✅ Test completed!');
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
  process.exit(1);
});

// Run the test
testTimestampConsistency().catch(console.error);