const io = require('socket.io-client');

// Test socket connection
const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling'],
  auth: {
    token: 'test-token' // You'll need a real token
  }
});

socket.on('connect', () => {
  console.log('✅ Connected to server');
  console.log('Socket ID:', socket.id);
});

socket.on('connected', (data) => {
  console.log('✅ Server confirmed connection:', data);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});

socket.on('socketError', (error) => {
  console.log('❌ Socket error:', error);
});

// Keep the process alive
setTimeout(() => {
  console.log('Closing connection...');
  socket.disconnect();
  process.exit(0);
}, 5000);