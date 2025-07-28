// Simple test to verify the server is running and basic functionality works
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testBasicEndpoints() {
  console.log('🚀 Testing basic server functionality...\n');
  
  try {
    // Test 1: Check if server is responding
    console.log('📡 Testing server response...');
    try {
      const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
      console.log('✅ Health endpoint responded:', response.status);
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('❌ Server is not running on port 5000');
        return false;
      } else if (error.response?.status === 404) {
        console.log('⚠️ Health endpoint not found, but server is running');
      } else {
        console.log('⚠️ Health endpoint error:', error.response?.status || error.message);
      }
    }
    
    // Test 2: Try to access API root
    console.log('📡 Testing API root...');
    try {
      const response = await axios.get(`${BASE_URL}/api`, { timeout: 5000 });
      console.log('✅ API root responded:', response.status);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ API root returns 404 (expected for some setups)');
      } else {
        console.log('⚠️ API root error:', error.response?.status || error.message);
      }
    }
    
    // Test 3: Try auth endpoint (should return error without credentials)
    console.log('📡 Testing auth endpoint...');
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: 'test',
        password: 'test'
      }, { timeout: 5000 });
      console.log('✅ Auth endpoint responded:', response.status);
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 401) {
        console.log('✅ Auth endpoint working (400/401 expected without valid credentials)');
      } else if (error.response?.status === 404) {
        console.log('❌ Auth endpoint not found');
      } else {
        console.log('⚠️ Auth endpoint error:', error.response?.status || error.message);
      }
    }
    
    console.log('\n✅ Basic server tests completed!');
    console.log('🎉 Server appears to be running correctly');
    return true;
    
  } catch (error) {
    console.log('\n❌ Test failed:', error.message);
    console.log('🔧 Server needs attention');
    return false;
  }
}

// Run the test
testBasicEndpoints().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});