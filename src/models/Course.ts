
import mongoose, {
  Schema,
  Document,
  Types,
} from "mongoose";

// Course lesson interface
export interface CourseLesson {
  title: string;
  description?: string;
  videoUrl?: string;
}

// Course interface
export interface ICourse extends Document {
  title: string;
  slug: string;
  description: string;
  category: string;
  level: string;
  image: string;
  imagePublicId: string;
  instructor: string;
  instructorId?: Types.ObjectId;
  duration: string;
  lessons: CourseLesson[];
  isPublished: boolean;
}

// Course schema
const courseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },

    image: {
      type: String,
      default: "",
    },

    imagePublicId: {
      type: String,
      default: "",
    },

    instructor: {
      type: String,
      default: "Decent Learning",
    },

    instructorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    duration: {
      type: String,
      default: "Self-paced",
    },

    lessons: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
        },

        description: {
          type: String,
          default: "",
        },

        videoUrl: {
          type: String,
          default: "",
        },
      },
    ],

    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Course = mongoose.model<ICourse>(
  "Course",
  courseSchema
);

export default Course;
