
import { Router } from "express";
import { getStudentDashboard } from "../controllers/dashboardController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { getMyEnrolledCourses } from "../controllers/enrollmentController.js";

const router = Router();

// Protected student dashboard
router.get("/dashboard", protect, getStudentDashboard);
router.get(
  "/my-courses",
  protect,
  authorize("student"),
  getMyEnrolledCourses
);

export default router;