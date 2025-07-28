import { Request } from "express";
import { body } from "express-validator";

const userRegisterValidator = (): any => {
  return [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("email is required")
      .isEmail()
      .withMessage("invalid email address"),

    body("username")
      .trim()
      .notEmpty()
      .withMessage("username is required")
      .isLowercase()
      .withMessage("username must be in lowercase")
      .isLength({ min: 3 })
      .withMessage("username must contain at least 3 characters"),

    body("password")
      .trim()
      .notEmpty()
      .withMessage("password is required")
      .isLength({ min: 4 })
      .withMessage("password must contain at least 4 characters"),
  ];
};

const userLoginValidator = (): any => {
  return [
    body("userId").trim().notEmpty().withMessage("userId is required"),
    body("password").trim().notEmpty().withMessage("password is required"),
  ];
};

const userProfileUpdateValidator = (): any => {
  return [
    body("username")
      .optional()
      .trim()
      .isLength({ min: 3 })
      .withMessage("username must contain at least 3 characters")
      .isLowercase()
      .withMessage("username must be in lowercase"),
    
    body("bio")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("bio must not exceed 200 characters"),
    
    body("statusMessage")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("status message must not exceed 100 characters"),
  ];
};

const changePasswordValidator = (): any => {
  return [
    body("currentPassword")
      .trim()
      .notEmpty()
      .withMessage("current password is required"),
    
    body("newPassword")
      .trim()
      .notEmpty()
      .withMessage("new password is required")
      .isLength({ min: 6 })
      .withMessage("new password must contain at least 6 characters"),
  ];
};

const userStatusUpdateValidator = (): any => {
  return [
    body("status")
      .isBoolean()
      .withMessage("status must be a boolean value"),
    
    body("statusMessage")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("status message must not exceed 100 characters"),
  ];
};

export { userRegisterValidator, userLoginValidator, userProfileUpdateValidator, changePasswordValidator, userStatusUpdateValidator };
