import mongoose from 'mongoose';

const NewsSchema = new mongoose.Schema(
  {
    source: {
      id: { type: String, default: null },
      name: { type: String, required: true },
    },
    author: {
      type: String,
      default: null,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
    url: {
      type: String,
      required: true,
    },
    urlToImage: {
      type: String,
      default: null,
    },
    publishedAt: {
      type: Date,
      required: true,
    },
    content: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export const News = mongoose.model('News', NewsSchema);
