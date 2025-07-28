const http = require("http");

// Test endpoints
const baseUrl = "http://10.1.0.211:5000";

function testEndpoint(path, method = "GET", headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "10.1.0.211",
      port: 5000,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
          });
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runTests() {
  console.log("🔍 Testing Chat App Endpoints...\n");

  // Test 1: Health check
  try {
    console.log("1️⃣ Testing Health Check...");
    const healthResponse = await testEndpoint("/health");
    console.log(
      `✅ Health Check: ${healthResponse.statusCode} - ${healthResponse.data}`
    );
  } catch (error) {
    console.log(`❌ Health Check Failed: ${error.message}`);
  }

  // Test 2: Chat users endpoint (without auth - should get 401)
  try {
    console.log("\n2️⃣ Testing /api/chat/users (without auth)...");
    const usersResponse = await testEndpoint("/api/chat/users");
    console.log(`Status: ${usersResponse.statusCode}`);
    console.log(`Response:`, usersResponse.data);
  } catch (error) {
    console.log(`❌ Users endpoint failed: ${error.message}`);
  }

  // Test 3: Chat endpoint (without auth - should get 401)
  try {
    console.log("\n3️⃣ Testing /api/chat (without auth)...");
    const chatResponse = await testEndpoint("/api/chat");
    console.log(`Status: ${chatResponse.statusCode}`);
    console.log(`Response:`, chatResponse.data);
  } catch (error) {
    console.log(`❌ Chat endpoint failed: ${error.message}`);
  }

  // Test 4: File metadata my-files endpoint (without auth - should get 401, not 400)
  try {
    console.log("\n4️⃣ Testing /api/file-metadata/my-files (without auth)...");
    const fileResponse = await testEndpoint(
      "/api/file-metadata/my-files?limit=50&skip=0"
    );
    console.log(`Status: ${fileResponse.statusCode}`);
    console.log(`Response:`, fileResponse.data);
    if (
      fileResponse.statusCode === 400 &&
      fileResponse.data.message === "Invalid file ID format"
    ) {
      console.log(
        "❌ ROUTE ORDERING ISSUE: my-files is being matched as /:fileId"
      );
    } else if (fileResponse.statusCode === 401) {
      console.log("✅ Route ordering fixed - getting auth error as expected");
    }
  } catch (error) {
    console.log(`❌ File metadata endpoint failed: ${error.message}`);
  }

  console.log("\n🎯 Test Summary:");
  console.log("- If health check passes, backend is running");
  console.log("- If endpoints return 401, authentication is working");
  console.log("- If endpoints return 404, routes are not properly configured");
}

runTests();
