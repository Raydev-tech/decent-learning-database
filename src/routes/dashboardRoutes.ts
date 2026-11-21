
import { Router } from "express";
import { getStudentDashboard } from "../controllers/dashboardController";
import { authorize, protect } from "../middleware/authMiddleware";
import { getMyEnrolledCourses } from "../controllers/enrollmentController";

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