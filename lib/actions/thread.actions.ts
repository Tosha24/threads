"use server";

import { revalidatePath } from "next/cache";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import Community from "../models/community.model";
import { connectToDB } from "../mongoose";

interface Params {
  text: string;
  author: string;
  communityId: string | null;
  path: string;
}

export async function createThread({
  text,
  author,
  communityId,
  path,
}: Params) {
  try {
    connectToDB();

    const communityIdObject = await Community.findOne(
      { id: communityId },
      { _id: 1 }
    );
    const createdThread = await Thread.create({
      text,
      author,
      community: communityIdObject,
    });

    // Update User model
    await User.findByIdAndUpdate(author, {
      $push: { threads: createdThread._id },
    });

    if (communityIdObject) {
      // Update Community Model
      await Community.findByIdAndUpdate(communityIdObject, {
        $push: { threads: createdThread._id },
      });
    }

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to create thread: ${error.message}`);
  }
}

export async function fetchPosts(pageNumber = 1, pageSize = 20) {
  try {
    connectToDB();

    // Calculate the number of posts to skip --> Implementation of Pagination
    const skipAmount = (pageNumber - 1) * pageSize;

    // Fetch the posts that have no parents (top-level threads) means their's parentId is null or undefined
    const postsQuery = Thread.find({ parentId: { $in: [null, undefined] } })
      .sort({ createdAt: "desc" })
      .skip(skipAmount)
      .limit(pageSize)
      .populate({
        path: "author",
        model: User,
      })
      .populate({
        path: "community",
        model: Community,
      })
      .populate({
        path: "children",
        populate: {
          path: "author",
          model: User,
          select: "_id name parentId image",
        },
      });

    // We count the total number of posts, so we can calculate the number of pages
    const totalPostsCount = await Thread.countDocuments({
      parentId: { $in: [null, undefined] },
    });

    const posts = await postsQuery.exec(); // execute the above query and store result in posts variable

    const isNext = totalPostsCount > skipAmount + posts.length; // if there are more posts to fetch, then isNext is true

    return { posts, isNext };
  } catch (error: any) {
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }
}

export async function fetchThreadById(threadId: string) {
  connectToDB();

  try {
    const thread = await Thread.findById(threadId)
      .populate({
        path: "author",
        model: User,
        select: "_id id name image",
      })
      .populate({
        path: "community",
        model: Community,
        select: "_id id name image",
      })
      .populate({
        path: "children",
        populate: [
          {
            path: "author",
            model: User,
            select: "_id id name parentId image",
          },
          {
            path: "children",
            model: Thread,
            populate: {
              path: "author",
              model: User,
              select: "_id id name parentId image",
            },
          },
        ],
      })
      .exec();

    return thread;
  } catch (error: any) {
    throw new Error(`Failed to fetch thread by id: ${error.message}`);
  }
}

export async function addCommentToThread(
  threadId: string,
  commentText: string,
  userId: string,
  path: string
) {
  connectToDB();

  try {
    // find the original thread by id
    const originalThread = await Thread.findById(threadId);

    if (!originalThread) throw new Error("Thread not found");

    // Create a new thread with comment text
    const commentThread = new Thread({
      text: commentText,
      author: userId,
      parentId: threadId,
    });

    // Save the new thread
    const savedCommentThread = await commentThread.save();

    // Update the original thread by adding the new thread to it's children
    originalThread.children.push(savedCommentThread._id);

    //  Save the changes in original thread
    await originalThread.save();

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to add comment to thread: ${error.message}`);
  }
}

export async function fetchAllChildThreads(threadId: string): Promise<any[]> {
  const childThreads = await Thread.find({ parentId: threadId });

  const descendantThreads = [];

  for(const childThread of childThreads){
    const descendants = await fetchAllChildThreads(childThread._id);
    descendantThreads.push(childThread, ...descendants);
  }
  return descendantThreads;
}

export async function deleteThread(id: string, path: string) : Promise<void> {
  try{
    connectToDB();

    // Find the thread to be deleted (the main thread)
    const mainThread = await Thread.findById(id).populate("author community");

    if(!mainThread){
      throw new Error("Thread not found");
    }

    // Fetch all child threads and their descendants recursively
    const descendantThreads = await fetchAllChildThreads(id);

    // Get all descendant Thread Ids including the main thread ID and child thread IDs
    const descendantThreadIds = [
      id,
      ...descendantThreads.map((thread) => thread.id),
    ];

    // Extract the authorIds and communityIds to update User and Community models respectively
    const uniqueAuthorIds = new Set(
      [
        ...descendantThreads.map((thread) => thread.author?._id?.toString()),
        mainThread.author?._id?.toString(),
      ].filter((id) => id !== undefined)
    );

    const uniqueCommunityIds = new Set([
      ...descendantThreads.map((thread) => thread.community?._id?.toString())
    ].filter((id) => id !== undefined)
    );

    // Recursively delete child threads and their descendants
    await Thread.deleteMany({ _id: { $in: descendantThreadIds } });

    // Update User Model
    await User.updateMany(
      { _id: { $in: Array.from(uniqueAuthorIds)}},
      { $pull: { threads: { $in: descendantThreadIds }}}
    );

    // Update Community Model
    await Community.updateMany(
      { _id: { $in: Array.from(uniqueCommunityIds)}},
      { $pull: { threads: { $in: descendantThreadIds}}}
    );

    revalidatePath(path);
  }
  catch(error: any){
    throw new Error(`Failed to delete thread: ${error.message}`);
  }
}