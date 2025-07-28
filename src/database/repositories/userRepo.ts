import { Aggregate, PipelineStage, Types } from "mongoose";
import User, { UserModel } from "../model/User";
import { RoleModel } from "../model/Role";
import { InternalError } from "../../core/ApiError";

class UserRepo {
  // search for existing users
  exists = async (id: Types.ObjectId): Promise<boolean> => {
    const user = await UserModel.exists({ _id: id, status: true });
    return user !== null;
  };

  // find profile by id
  findById = (id: Types.ObjectId): Promise<User | null> => {
    return UserModel.findOne(id)
      .populate({
        path: "roles",
        match: { status: true },
        select: { code: 1 },
      })
      .lean();
  };

  // find profile by id with password (for password operations)
  findByIdWithPassword = (id: Types.ObjectId): Promise<User | null> => {
    return UserModel.findOne({ _id: id })
      .select("+password")
      .populate({
        path: "roles",
        match: { status: true },
        select: { code: 1 },
      })
      .lean();
  };

  // find profile by username
  findByUsername = (username: string): Promise<User | null> => {
    return UserModel.findOne({ username: username })
      .populate({
        path: "roles",
        match: { status: true },
        select: { code: 1 },
      })
      .lean();
  };

  // find profile by email
  findByEmail = (email: string): Promise<User | null> => {
    return UserModel.findOne({ email: email })
      .populate({
        path: "roles",
        match: { status: true },
        select: { code: 1 },
      })
      .lean();
  };

  // find profile by email or username
  findByEmailOrUsername = (id: string): Promise<User | null> => {
    // temp
    const user = UserModel.findOne({
      $or: [{ email: id }, { username: id }],
    })
      .select("+password")
      .populate({
        path: "roles",
        match: { status: true },
        select: { code: 1, _id: 0 },
      })
      .lean()
      .exec();
    return user;
  };

  // fetch only selective fields by id
  findFieldsById = (
    id: Types.ObjectId,
    ...fields: string[]
  ): Promise<User | null> => {
    return UserModel.findOne({ _id: id, status: true })
      .select(fields.join(" "))
      .lean();
  };

  // create a new user with their keystore
  create = async (user: User, roleCode: string): Promise<User> => {
    const role = await RoleModel.findOne({ code: roleCode })
      .select("+code")
      .lean();
    if (!role) throw new InternalError("role must be specified");

    user.roles = [role];

    const createdUser = await UserModel.create(user);

    return createdUser.toObject();
  };

  // update user profile
  update = async (
    user: User,
    accessTokenKey: string,
    refreshTokenKey: string
  ): Promise<{ user: User }> => {
    user.updatedAt = new Date();
    await UserModel.findByIdAndUpdate(
      user._id,
      { $set: { ...user } },
      { new: true }
    ).lean();

    return { user };
  };

  // update user info only
  updateInfo = (user: User): Promise<any> => {
    user.updatedAt = new Date();
    return UserModel.findByIdAndUpdate(
      user._id,
      { $set: { ...user } },
      { new: true }
    ).lean();
  };

  // search available users
  searchAvailableUsers = (
    currentUser: User,
    searchTermUsernameOrEmail: string
  ): Aggregate<any> => {
    return UserModel.aggregate([
      {
        $match: {
          _id: {
            $ne: currentUser._id, // skip the logged in user
          },
          status: true,
          $or: [
            { username: { $regex: searchTermUsernameOrEmail, $options: "i" } },
            { email: { $regex: searchTermUsernameOrEmail, $options: "i" } },
            { bio: { $regex: searchTermUsernameOrEmail, $options: "i" } }, // Also search in bio
          ],
        },
      },
      {
        $project: {
          avatarUrl: 1,
          username: 1,
          email: 1,
          bio: 1, // Include bio in results
        },
      },
      {
        $sort: { username: 1 } // Sort alphabetically by username
      },
      {
        $limit: 50 // Limit results for better performance
      }
    ]);
  };

  // get all users except the current user
  getAllUsers = (currentUser: User): Aggregate<any> => {
    return UserModel.aggregate([
      {
        $match: {
          _id: {
            $ne: currentUser._id, // skip the logged in user
          },
          status: true,
        },
      },
      {
        $project: {
          avatarUrl: 1,
          username: 1,
          email: 1,
          bio: 1,  // Include bio for more user information
        },
      },
      {
        $sort: { username: 1 } // Sort alphabetically by username
      },
      {
        $limit: 100 // Limit results for better performance in LAN environments
      }
    ]);
  };

  // Find user by ID and update with new data
  findByIdAndUpdate = async (
    id: Types.ObjectId,
    updateData: Partial<User>
  ): Promise<User | null> => {
    updateData.updatedAt = new Date();
    
    return UserModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    )
      .populate({
        path: "roles",
        match: { status: true },
        select: { code: 1 },
      })
      .lean();
  };

  // Get user by ID with public key
  async getUserById(id: Types.ObjectId): Promise<User | null> {
    return UserModel.findById(id)
      .select('+publicKey +keyVersion +keyGeneratedAt')
      .lean()
      .exec();
  }

  // Get multiple users by IDs with public keys
  async getUsersByIds(ids: Types.ObjectId[]): Promise<User[]> {
    return UserModel.find({ _id: { $in: ids } })
      .select('username email publicKey keyVersion keyGeneratedAt')
      .lean()
      .exec();
  }

  // Update user by ID
  async updateUserById(id: Types.ObjectId, updateData: Partial<User>): Promise<User | null> {
    return UserModel.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
    .select('+publicKey +keyVersion +keyGeneratedAt')
    .lean()
    .exec();
  }

  // Check if user has E2EE set up
  async hasE2EESetup(id: Types.ObjectId): Promise<boolean> {
    const user = await UserModel.findById(id)
      .select('publicKey')
      .lean()
      .exec();
    
    return !!(user && user.publicKey);
  }

  // Get users with E2EE capability in a chat
  async getUsersWithE2EEInChat(chatId: Types.ObjectId): Promise<User[]> {
    // This would need to be implemented based on your chat participants logic
    // For now, returning a placeholder
    return [];
  }
}

export default new UserRepo();