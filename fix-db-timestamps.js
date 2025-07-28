const { MongoClient } = require("mongodb");

// Replace with your MongoDB connection string
const MONGODB_URI = process.env.DB_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "chatapp_db";

async function fixTimestamps() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(DB_NAME);
    const messagesCollection = db.collection("messages");

    // Find messages with future dates (2025 or later)
    const futureMessages = await messagesCollection
      .find({
        createdAt: { $gte: new Date("2025-01-01") },
      })
      .count();

    console.log(`Found ${futureMessages} messages with future timestamps`);

    if (futureMessages > 0) {
      // Calculate the time difference (approximately 1 year back)
      const oneYearInMs = 365 * 24 * 60 * 60 * 1000;

      // Update messages to subtract one year from their timestamps
      const result = await messagesCollection.updateMany(
        { createdAt: { $gte: new Date("2025-01-01") } },
        [
          {
            $set: {
              createdAt: {
                $dateSubtract: {
                  startDate: "$createdAt",
                  unit: "year",
                  amount: 1,
                },
              },
              updatedAt: {
                $dateSubtract: {
                  startDate: "$updatedAt",
                  unit: "year",
                  amount: 1,
                },
              },
            },
          },
        ]
      );

      console.log(`Updated ${result.modifiedCount} messages`);
    }

    // Also fix chat timestamps if needed
    const chatsCollection = db.collection("chats");
    const futureChats = await chatsCollection
      .find({
        createdAt: { $gte: new Date("2025-01-01") },
      })
      .count();

    console.log(`Found ${futureChats} chats with future timestamps`);

    if (futureChats > 0) {
      const chatResult = await chatsCollection.updateMany(
        { createdAt: { $gte: new Date("2025-01-01") } },
        [
          {
            $set: {
              createdAt: {
                $dateSubtract: {
                  startDate: "$createdAt",
                  unit: "year",
                  amount: 1,
                },
              },
              updatedAt: {
                $dateSubtract: {
                  startDate: "$updatedAt",
                  unit: "year",
                  amount: 1,
                },
              },
            },
          },
        ]
      );

      console.log(`Updated ${chatResult.modifiedCount} chats`);
    }

    // Also fix user timestamps if needed
    const usersCollection = db.collection("users");
    const futureUsers = await usersCollection
      .find({
        $or: [
          { createdAt: { $gte: new Date("2025-01-01") } },
          { updatedAt: { $gte: new Date("2025-01-01") } },
          { lastSeen: { $gte: new Date("2025-01-01") } },
        ],
      })
      .count();

    console.log(`Found ${futureUsers} users with future timestamps`);

    if (futureUsers > 0) {
      const userResult = await usersCollection.updateMany(
        {
          $or: [
            { createdAt: { $gte: new Date("2025-01-01") } },
            { updatedAt: { $gte: new Date("2025-01-01") } },
            { lastSeen: { $gte: new Date("2025-01-01") } },
          ],
        },
        [
          {
            $set: {
              createdAt: {
                $cond: {
                  if: { $gte: ["$createdAt", new Date("2025-01-01")] },
                  then: {
                    $dateSubtract: {
                      startDate: "$createdAt",
                      unit: "year",
                      amount: 1,
                    },
                  },
                  else: "$createdAt",
                },
              },
              updatedAt: {
                $cond: {
                  if: { $gte: ["$updatedAt", new Date("2025-01-01")] },
                  then: {
                    $dateSubtract: {
                      startDate: "$updatedAt",
                      unit: "year",
                      amount: 1,
                    },
                  },
                  else: "$updatedAt",
                },
              },
              lastSeen: {
                $cond: {
                  if: {
                    $and: [
                      "$lastSeen",
                      { $gte: ["$lastSeen", new Date("2025-01-01")] },
                    ],
                  },
                  then: {
                    $dateSubtract: {
                      startDate: "$lastSeen",
                      unit: "year",
                      amount: 1,
                    },
                  },
                  else: "$lastSeen",
                },
              },
            },
          },
        ]
      );

      console.log(`Updated ${userResult.modifiedCount} users`);
    }

    // Also fix file metadata timestamps
    const fileMetadataCollection = db.collection("filemetadatas");
    const futureFiles = await fileMetadataCollection
      .find({
        $or: [
          { uploadedAt: { $gte: new Date("2025-01-01") } },
          { createdAt: { $gte: new Date("2025-01-01") } },
          { updatedAt: { $gte: new Date("2025-01-01") } },
        ],
      })
      .count();

    console.log(`Found ${futureFiles} file metadata with future timestamps`);

    if (futureFiles > 0) {
      const fileResult = await fileMetadataCollection.updateMany(
        {
          $or: [
            { uploadedAt: { $gte: new Date("2025-01-01") } },
            { createdAt: { $gte: new Date("2025-01-01") } },
            { updatedAt: { $gte: new Date("2025-01-01") } },
          ],
        },
        [
          {
            $set: {
              uploadedAt: {
                $cond: {
                  if: { $gte: ["$uploadedAt", new Date("2025-01-01")] },
                  then: {
                    $dateSubtract: {
                      startDate: "$uploadedAt",
                      unit: "year",
                      amount: 1,
                    },
                  },
                  else: "$uploadedAt",
                },
              },
              createdAt: {
                $cond: {
                  if: { $gte: ["$createdAt", new Date("2025-01-01")] },
                  then: {
                    $dateSubtract: {
                      startDate: "$createdAt",
                      unit: "year",
                      amount: 1,
                    },
                  },
                  else: "$createdAt",
                },
              },
              updatedAt: {
                $cond: {
                  if: { $gte: ["$updatedAt", new Date("2025-01-01")] },
                  then: {
                    $dateSubtract: {
                      startDate: "$updatedAt",
                      unit: "year",
                      amount: 1,
                    },
                  },
                  else: "$updatedAt",
                },
              },
            },
          },
        ]
      );

      console.log(`Updated ${fileResult.modifiedCount} file metadata records`);
    }

    console.log("✅ Complete database timestamp fix completed!");
  } catch (error) {
    console.error("❌ Error fixing timestamps:", error);
  } finally {
    await client.close();
  }
}

// Run the fix
fixTimestamps();
