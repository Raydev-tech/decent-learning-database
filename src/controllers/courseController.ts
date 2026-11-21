
import { Request, Response } from "express";
import mongoose from "mongoose";

import Course, {
  CourseLesson,
  ICourse,
} from "../models/Course";

import cloudinary from "../config/cloudinary";

// ==========================================
// CLOUDINARY IMAGE UPLOAD
// ==========================================

const uploadToCloudinary = (
  file: Express.Multer.File
): Promise<{ secure_url: string; public_id: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "decent-learning/courses",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          console.error("CLOUDINARY UPLOAD DETAILS:");
          console.dir(error, { depth: null });
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary returned no upload result."));
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    uploadStream.end(file.buffer);
  });
};

// ==========================================
// DELETE CLOUDINARY IMAGE
// ==========================================

const deleteCloudinaryImage = async (
  publicId?: string
): Promise<void> => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary image deletion error:", error);
  }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Safely read Express route parameters
const getParamString = (
  value: string | string[] | undefined
): string => {
  return typeof value === "string" ? value : "";
};

// Parse and validate lessons
const parseLessons = (value: unknown): CourseLesson[] => {
  if (!value) return [];

  let parsed: unknown = value;

  if (typeof value === "string") {
    parsed = JSON.parse(value);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Lessons must be an array.");
  }

  return parsed.map((lesson: unknown): CourseLesson => {
    if (
      typeof lesson !== "object" ||
      lesson === null ||
      !("title" in lesson) ||
      typeof lesson.title !== "string" ||
      !lesson.title.trim()
    ) {
      throw new Error("Every lesson must have a valid title.");
    }

    const item = lesson as {
      title: string;
      description?: unknown;
      videoUrl?: unknown;
    };

    return {
      title: item.title.trim(),
      description:
        typeof item.description === "string"
          ? item.description
          : "",
      videoUrl:
        typeof item.videoUrl === "string"
          ? item.videoUrl
          : "",
    };
  });
};

// Parse boolean values sent through FormData
const parseBoolean = (value: unknown): boolean => {
  return value === true || value === "true";
};

// Check whether a user can manage a course
const canManageCourse = (
  course: ICourse,
  userId: string,
  userRole: string
): boolean => {
  // Admins can manage all courses
  if (userRole === "admin") {
    return true;
  }

  // Instructors can only manage their own courses
  if (userRole === "instructor") {
    return course.instructorId?.toString() === userId;
  }

  return false;
};

// ==========================================
// CREATE COURSE
// ==========================================

export const createCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  let uploadedPublicId = "";

  try {
    const userId = String(res.locals.userId || "");
    const userRole = String(res.locals.userRole || "");

    // Validate authenticated user
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        success: false,
        message: "Invalid authenticated user.",
      });
      return;
    }

    // Only instructors and admins can create courses
    if (!["instructor", "admin"].includes(userRole)) {
      res.status(403).json({
        success: false,
        message: "Only instructors and admins can create courses.",
      });
      return;
    }

    const {
      title,
      slug,
      description,
      category,
      level,
      instructor,
      duration,
      isPublished,
    } = req.body;

    // Validate required fields
    if (
      typeof title !== "string" ||
      typeof slug !== "string" ||
      typeof description !== "string" ||
      typeof category !== "string" ||
      typeof level !== "string" ||
      typeof duration !== "string" ||
      !title.trim() ||
      !slug.trim() ||
      !description.trim() ||
      !category.trim() ||
      !level.trim() ||
      !duration.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide all required course fields.",
      });
      return;
    }

    const normalizedSlug = slug.toLowerCase().trim();

    // Check duplicate slug
    const existingCourse = await Course.findOne({
      slug: normalizedSlug,
    });

    if (existingCourse) {
      res.status(409).json({
        success: false,
        message: "A course with this slug already exists.",
      });
      return;
    }

    // Validate lessons
    const lessons = parseLessons(req.body.lessons);

    let image = "";
    let imagePublicId = "";

    // Upload course image
    if (req.file) {
      const uploadedImage = await uploadToCloudinary(req.file);

      image = uploadedImage.secure_url;
      imagePublicId = uploadedImage.public_id;
      uploadedPublicId = imagePublicId;
    }

    // Create course with authenticated owner
    const course = await Course.create({
      title: title.trim(),
      slug: normalizedSlug,
      description: description.trim(),
      category: category.trim(),
      level,
      image,
      imagePublicId,

      instructor:
        typeof instructor === "string" && instructor.trim()
          ? instructor.trim()
          : "Decent Learning",

      // Automatically assign the logged-in user
      instructorId: new mongoose.Types.ObjectId(userId),

      duration: duration.trim(),
      lessons,
      isPublished: parseBoolean(isPublished),
    });

    res.status(201).json({
      success: true,
      message: "Course created successfully.",
      data: course,
    });
  } catch (error) {
    await deleteCloudinaryImage(uploadedPublicId);

    console.error("Create course error:", error);

    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create course.",
    });
  }
};

// ==========================================
// GET ALL PUBLISHED COURSES
// ==========================================

export const getAllCourses = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const courses = await Course.find({
      isPublished: true,
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    res.status(200).json({
      success: true,
      message: "Courses retrieved successfully.",
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error("Get courses error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve courses.",
    });
  }
};

// ==========================================
// GET COURSE BY SLUG
// ==========================================

export const getCourseBySlug = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const slug = getParamString(req.params.slug);

    if (!slug) {
      res.status(400).json({
        success: false,
        message: "A valid course slug is required.",
      });
      return;
    }

    const course = await Course.findOne({
      slug: slug.toLowerCase(),
      isPublished: true,
    }).select("-__v");

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Course retrieved successfully.",
      data: course,
    });
  } catch (error) {
    console.error("Get course by slug error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve course.",
    });
  }
};

// ==========================================
// UPDATE COURSE
// ==========================================

export const updateCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  let uploadedPublicId = "";

  try {
    const id = getParamString(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID.",
      });
      return;
    }

    const userId = String(res.locals.userId || "");
    const userRole = String(res.locals.userRole || "");

    const course = await Course.findById(id);

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found.",
      });
      return;
    }

    // Verify course ownership
    if (!canManageCourse(course, userId, userRole)) {
      res.status(403).json({
        success: false,
        message: "You are not allowed to update this course.",
      });
      return;
    }

    // Update title
    if (typeof req.body.title === "string") {
      if (!req.body.title.trim()) {
        res.status(400).json({
          success: false,
          message: "Course title cannot be empty.",
        });
        return;
      }

      course.title = req.body.title.trim();
    }

    // Update description
    if (typeof req.body.description === "string") {
      course.description = req.body.description.trim();
    }

    // Update category
    if (typeof req.body.category === "string") {
      course.category = req.body.category.trim();
    }

    // Update level
    if (typeof req.body.level === "string") {
      course.level = req.body.level;
    }

    // Only admins can change the instructor display name
    if (
      userRole === "admin" &&
      typeof req.body.instructor === "string"
    ) {
      course.instructor = req.body.instructor.trim();
    }

    // Update duration
    if (typeof req.body.duration === "string") {
      course.duration = req.body.duration.trim();
    }

    // Update slug
    if (req.body.slug !== undefined) {
      if (
        typeof req.body.slug !== "string" ||
        !req.body.slug.trim()
      ) {
        res.status(400).json({
          success: false,
          message: "Please provide a valid course slug.",
        });
        return;
      }

      const normalizedSlug = req.body.slug.toLowerCase().trim();

      const existingCourse = await Course.findOne({
        slug: normalizedSlug,
        _id: { $ne: id },
      });

      if (existingCourse) {
        res.status(409).json({
          success: false,
          message: "Another course already uses this slug.",
        });
        return;
      }

      course.slug = normalizedSlug;
    }

    // Update lessons
    if (req.body.lessons !== undefined) {
      course.set("lessons", parseLessons(req.body.lessons));
    }

    // Update published status
    if (req.body.isPublished !== undefined) {
      course.isPublished = parseBoolean(req.body.isPublished);
    }

    // Keep old image until new image uploads successfully
    const oldPublicId = course.imagePublicId;

    if (req.file) {
      const uploadedImage = await uploadToCloudinary(req.file);

      uploadedPublicId = uploadedImage.public_id;

      course.image = uploadedImage.secure_url;
      course.imagePublicId = uploadedImage.public_id;
    }

    // Save course changes
    await course.save();

    // Delete old image after successful database update
    if (req.file && oldPublicId) {
      await deleteCloudinaryImage(oldPublicId);
    }

    res.status(200).json({
      success: true,
      message: "Course updated successfully.",
      data: course,
    });
  } catch (error) {
    await deleteCloudinaryImage(uploadedPublicId);

    console.error("Update course error:", error);

    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update course.",
    });
  }
};

// ==========================================
// DELETE COURSE
// ==========================================

export const deleteCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = getParamString(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID.",
      });
      return;
    }

    const userId = String(res.locals.userId || "");
    const userRole = String(res.locals.userRole || "");

    const course = await Course.findById(id);

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found.",
      });
      return;
    }

    // Verify course ownership
    if (!canManageCourse(course, userId, userRole)) {
      res.status(403).json({
        success: false,
        message: "You are not allowed to delete this course.",
      });
      return;
    }

    // Delete course from MongoDB
    await course.deleteOne();

    // Delete associated Cloudinary image
    await deleteCloudinaryImage(course.imagePublicId);

    res.status(200).json({
      success: true,
      message: "Course deleted successfully.",
    });
  } catch (error) {
    console.error("Delete course error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete course.",
    });
  }
};

// ==========================================
// GET LOGGED-IN INSTRUCTOR'S COURSES
// ==========================================

export const getMyCourses = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = String(res.locals.userId || "");
    const userRole = String(res.locals.userRole || "");

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        success: false,
        message: "Invalid authenticated user.",
      });
      return;
    }

    if (userRole !== "instructor" && userRole !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only instructors can access their courses.",
      });
      return;
    }

    const courses = await Course.find({
      instructorId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    res.status(200).json({
      success: true,
      message: "Your courses were retrieved successfully.",
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error("Get instructor courses error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve your courses.",
    });
  }
};