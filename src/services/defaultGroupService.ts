import { Types } from "mongoose";
import { ChatModel } from "../database/model/Chat";
import colorsUtils from "../helpers/colorsUtils";

export class DefaultGroupService {
  private static readonly DEFAULT_GROUP_ID = "67890abcdef1234567890abc"; // Valid 24-character hex string
  private static readonly DEFAULT_GROUP_NAME = "adrdeConnomgpo";

  /**
   * Initialize the default group on server startup
   */
  static async initializeDefaultGroup(): Promise<void> {
    try {
      colorsUtils.log("info", "🏗️ Initializing default group...");

      // Check if default group already exists
      const existingGroup = await ChatModel.findOne({
        name: this.DEFAULT_GROUP_NAME,
        isDefault: true,
      });

      if (existingGroup) {
        colorsUtils.log("success", `✅ Default group "${this.DEFAULT_GROUP_NAME}" already exists`);
        colorsUtils.log("info", `📋 Group ID: ${existingGroup._id}`);
        colorsUtils.log("info", `👥 Current participants: ${existingGroup.participants.length}`);
        return;
      }

      // Create the default group with a specific ObjectId
      const defaultGroupObjectId = new Types.ObjectId(this.DEFAULT_GROUP_ID);
      
      // Create a system admin user ID (you might want to create a system user)
      // For now, we'll use the first user as admin, or create with a placeholder
      const systemAdminId = new Types.ObjectId("000000000000000000000001"); // Placeholder system admin

      const defaultGroup = await ChatModel.create({
        _id: defaultGroupObjectId,
        name: this.DEFAULT_GROUP_NAME,
        isGroupChat: true,
        isDefault: true,
        participants: [], // Will be populated as users join
        admin: systemAdminId,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Ensure all required fields are present
        lastMessage: null,
        lastMessageText: null,
        lastMessageTimestamp: null,
        lastMessageSender: null,
        lastMessageType: null,
        unreadCount: new Map(),
      });

      colorsUtils.log("success", `🎉 Default group "${this.DEFAULT_GROUP_NAME}" created successfully`);
      colorsUtils.log("info", `📋 Group ID: ${defaultGroup._id}`);
      colorsUtils.log("info", `🏷️ Group Type: ${defaultGroup.isGroupChat ? 'Group Chat' : 'Direct Chat'}`);
      colorsUtils.log("info", `⭐ Is Default: ${defaultGroup.isDefault}`);
    } catch (error) {
      colorsUtils.log("error", `❌ Error initializing default group: ${error}`);
      console.error("Default group initialization error:", error);
      
      // Try to handle duplicate key error
      if (typeof error === "object" && error !== null && "code" in error && (error as any).code === 11000) {
        colorsUtils.log("warning", "⚠️ Default group might already exist with this ID");
        // Try to find and update existing group
        try {
          const existingById = await ChatModel.findById(this.DEFAULT_GROUP_ID);
          if (existingById) {
            await ChatModel.findByIdAndUpdate(this.DEFAULT_GROUP_ID, {
              name: this.DEFAULT_GROUP_NAME,
              isDefault: true,
              isGroupChat: true,
            });
            colorsUtils.log("success", "✅ Updated existing group to be default group");
          }
        } catch (updateError) {
          colorsUtils.log("error", `❌ Failed to update existing group: ${updateError}`);
        }
      }
    }
  }

  /**
   * Add a user to the default group
   */
  static async addUserToDefaultGroup(userId: Types.ObjectId): Promise<boolean> {
    try {
      colorsUtils.log("info", `👤 Adding user ${userId} to default group...`);

      // First, ensure the default group exists
      const defaultGroup = await ChatModel.findOne({
        name: this.DEFAULT_GROUP_NAME,
        isDefault: true
      });

      if (!defaultGroup) {
        colorsUtils.log("warning", "⚠️ Default group not found, attempting to create it...");
        await this.initializeDefaultGroup();
      }

      const result = await ChatModel.updateOne(
        { 
          name: this.DEFAULT_GROUP_NAME,
          isDefault: true 
        },
        { 
          $addToSet: { participants: userId },
          $set: { updatedAt: new Date() }
        }
      );

      if (result.modifiedCount > 0) {
        colorsUtils.log("success", `✅ User ${userId} added to default group`);
        
        // Verify the user was actually added
        const updatedGroup = await ChatModel.findOne({
          name: this.DEFAULT_GROUP_NAME,
          isDefault: true
        });
        
        if (updatedGroup) {
          colorsUtils.log("info", `📊 Default group now has ${updatedGroup.participants.length} participants`);
        }
        
        return true;
      } else {
        // Check if user is already in the group
        const groupWithUser = await ChatModel.findOne({
          name: this.DEFAULT_GROUP_NAME,
          isDefault: true,
          participants: { $elemMatch: { $eq: userId } }
        });

        if (groupWithUser) {
          colorsUtils.log("info", `ℹ️ User ${userId} already in default group`);
          return true; // User is already in group, which is success
        } else {
          colorsUtils.log("warning", `⚠️ Default group not found for user addition`);
          return false;
        }
      }
    } catch (error) {
      colorsUtils.log("error", `❌ Error adding user to default group: ${error}`);
      console.error("Add user to default group error:", error);
      return false;
    }
  }

  /**
   * Get the default group
   */
  static async getDefaultGroup(): Promise<any> {
    try {
      const defaultGroup = await ChatModel.findOne({
        name: this.DEFAULT_GROUP_NAME,
        isDefault: true,
      }).populate('participants', 'username email avatarUrl');

      return defaultGroup;
    } catch (error) {
      colorsUtils.log("error", `❌ Error getting default group: ${error}`);
      return null;
    }
  }

  /**
   * Get the default group ID
   */
  static getDefaultGroupId(): string {
    return this.DEFAULT_GROUP_ID;
  }

  /**
   * Get the default group name
   */
  static getDefaultGroupName(): string {
    return this.DEFAULT_GROUP_NAME;
  }

  /**
   * Check if a group is the default group
   */
  static isDefaultGroup(groupId: string | Types.ObjectId): boolean {
    return groupId.toString() === this.DEFAULT_GROUP_ID;
  }

  /**
   * Remove a user from the default group (optional - for user deletion scenarios)
   */
  static async removeUserFromDefaultGroup(userId: Types.ObjectId): Promise<boolean> {
    try {
      colorsUtils.log("info", `👤 Removing user ${userId} from default group...`);

      const result = await ChatModel.updateOne(
        { 
          name: this.DEFAULT_GROUP_NAME,
          isDefault: true 
        },
        { 
          $pull: { participants: userId },
          $set: { updatedAt: new Date() }
        }
      );

      if (result.modifiedCount > 0) {
        colorsUtils.log("success", `✅ User ${userId} removed from default group`);
        return true;
      } else {
        colorsUtils.log("info", `ℹ️ User ${userId} not in default group or group not found`);
        return false;
      }
    } catch (error) {
      colorsUtils.log("error", `❌ Error removing user from default group: ${error}`);
      console.error("Remove user from default group error:", error);
      return false;
    }
  }
}

export default DefaultGroupService;