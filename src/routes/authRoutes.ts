import { Router } from "express";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { register, login, logout, getProfile, updateProfile, getAllStudents, createInstructor, instructorLogin,  } from "../controllers/authController.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/logout", logout);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
// ADMIN: GET ALL STUDENTS
router.get(
  "/students",
  protect,
  getAllStudents
);
// ADMIN: CREATE INSTRUCTOR ACCOUNT
router.post(
  "/create-instructor",
  createInstructor
);

// INSTRUCTOR LOGIN
router.post(
  "/instructor-login",
  instructorLogin
);

export default router;