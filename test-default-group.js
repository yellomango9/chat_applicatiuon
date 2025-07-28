const mongoose = require('mongoose');
const { ChatModel } = require('./src/database/model/Chat');
const DefaultGroupService = require('./src/services/defaultGroupService').default;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/chat_app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testDefaultGroup() {
  try {
    console.log('🧪 Testing Default Group Implementation...\n');

    // Test 1: Initialize default group
    console.log('1️⃣ Testing default group initialization...');
    await DefaultGroupService.initializeDefaultGroup();
    
    // Test 2: Check if default group exists
    console.log('2️⃣ Checking if default group exists...');
    const defaultGroup = await DefaultGroupService.getDefaultGroup();
    if (defaultGroup) {
      console.log('✅ Default group found:', {
        id: defaultGroup._id,
        name: defaultGroup.name,
        isDefault: defaultGroup.isDefault,
        participantCount: defaultGroup.participants.length
      });
    } else {
      console.log('❌ Default group not found');
    }

    // Test 3: Add a test user to default group
    console.log('3️⃣ Testing adding user to default group...');
    const testUserId = new mongoose.Types.ObjectId();
    const addResult = await DefaultGroupService.addUserToDefaultGroup(testUserId);
    console.log('Add user result:', addResult);

    // Test 4: Check if user was added
    console.log('4️⃣ Verifying user was added...');
    const updatedGroup = await DefaultGroupService.getDefaultGroup();
    if (updatedGroup) {
      console.log('✅ Updated group participant count:', updatedGroup.participants.length);
      console.log('User in group:', updatedGroup.participants.includes(testUserId));
    }

    // Test 5: Try adding same user again (should not duplicate)
    console.log('5️⃣ Testing duplicate user addition...');
    const duplicateResult = await DefaultGroupService.addUserToDefaultGroup(testUserId);
    console.log('Duplicate add result:', duplicateResult);

    // Test 6: Check final state
    console.log('6️⃣ Final verification...');
    const finalGroup = await DefaultGroupService.getDefaultGroup();
    if (finalGroup) {
      console.log('✅ Final group state:', {
        id: finalGroup._id,
        name: finalGroup.name,
        isDefault: finalGroup.isDefault,
        participantCount: finalGroup.participants.length
      });
    }

    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

testDefaultGroup();