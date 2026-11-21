
import { Request, Response } from "express";
import mongoose from "mongoose";
import Enrollment from "../models/Enrollment";

export const getMyEnrolledCourses = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const studentId = String(res.locals.userId || "");

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      res.status(401).json({
        success: false,
        message: "Invalid student account.",
      });
      return;
    }

    const enrollments = await Enrollment.find({
      student: new mongoose.Types.ObjectId(studentId),
    })
      .populate({
        path: "course",
        select:
          "title slug description category level image instructor duration lessons isPublished",
      })
      .sort({ enrolledAt: -1 });

    const courses = enrollments
      .filter((enrollment) => {
        const course = enrollment.course as any;
        return course && course.isPublished === true;
      })
      .map((enrollment) => {
        const course = enrollment.course as any;

        const totalLessons = course.lessons?.length || 0;
        const completedLessons =
          enrollment.completedLessons?.length || 0;

        const progress =
          totalLessons > 0
            ? Math.min(
                100,
                Math.round((completedLessons / totalLessons) * 100)
              )
            : 0;

        return {
          _id: course._id,
          title: course.title,
          slug: course.slug,
          description: course.description,
          category: course.category,
          level: course.level,
          image: course.image,
          instructor: course.instructor,
          duration: course.duration,
          totalLessons,
          completedLessons,
          progress,
          status:
            progress >= 100
              ? "Completed"
              : progress > 0
                ? "In progress"
                : "Not started",
          enrolledAt: enrollment.enrolledAt,
          enrollmentId: enrollment._id,
        };
      });

    res.status(200).json({
      success: true,
      message: "Your enrolled courses were retrieved successfully.",
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error("Get enrolled courses error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve your enrolled courses.",
    });
  }
};
