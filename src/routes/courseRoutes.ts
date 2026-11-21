import { Router } from "express";

import {
  createCourse,
  getAllCourses,
  getCourseBySlug,
  getMyCourses,
  updateCourse,
  deleteCourse,
} from "../controllers/courseController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

import upload from "../middleware/uploadMiddleware.js";

const router = Router();

// PUBLIC: GET ALL PUBLISHED COURSES
router.get("/", getAllCourses);

// PROTECTED: GET LOGGED-IN INSTRUCTOR'S COURSES
router.get(
  "/my-courses",
  protect,
  authorize("instructor", "admin"),
  getMyCourses
);

// PUBLIC: GET COURSE BY SLUG
router.get("/:slug", getCourseBySlug);

// CREATE COURSE
router.post(
  "/",
  protect,
  authorize("instructor", "admin"),
  upload.single("image"),
  createCourse
);

// UPDATE COURSE
router.put(
  "/:id",
  protect,
  authorize("instructor", "admin"),
  upload.single("image"),
  updateCourse
);

// DELETE COURSE
router.delete(
  "/:id",
  protect,
  authorize("instructor", "admin"),
  deleteCourse
);

export default router;