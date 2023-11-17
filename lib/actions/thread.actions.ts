"use server"

import { revalidatePath } from "next/cache";
import Thread from "../models/thread.model";
import User from "../models/user.model";
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

    const createdThread = await Thread.create({
      text,
      author,
      community: null,
    });

    // Update User model
    await User.findByIdAndUpdate(author, {
      $push: { threads: createdThread._id },
    });

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to create thread: ${error.message}`);
  }
}

export async function fetchPosts(pageNumber = 1, pageSize = 20){
  try{
    connectToDB();

    // Calculate the number of posts to skip --> Implementation of Pagination
    const skipAmount = (pageNumber - 1) * pageSize;
    
    // Fetch the posts that have no parents (top-level threads) means their's parentId is null or undefined
    const postsQuery = Thread.find({ parentId: { $in: [null, undefined]}})
      .sort({ createdAt: 'desc' })
      .skip(skipAmount)
      .limit(pageSize)
      .populate({
        path: 'author',
        model: User
      })
      .populate({
        path: 'children',
        populate: {
          path: 'author',
          model: User,
          select: '_id name parentId image'
        }
      })
    
    // We count the total number of posts, so we can calculate the number of pages
    const totalPostsCount = await Thread.countDocuments({ parentId: { $in: [null, undefined] }});

    const posts = await postsQuery.exec();    // execute the above query and store result in posts variable

    const isNext = totalPostsCount > skipAmount + posts.length;   // if there are more posts to fetch, then isNext is true

    return { posts, isNext };
  }
  catch(error: any){
    throw new Error(`Failed to fetch posts: ${error.message}`)
  }
}

export async function fetchThreadById(id: string){
  connectToDB();

  try{

    //  TODO: Populate Community 
    const thread = await Thread.findById(id)
      .populate({
        path: 'author',
        model: User,
        select: '_id id name image'
      })
      .populate({
        path: 'children',
        populate: [
          {
            path: 'author',
            model: User,
            select: '_id id name parentId image'
          },
          {
            path: 'children',
            model: Thread,
            populate: {
              path: 'author',
              model: User,
              select: '_id id name parentId image'
            }
          }
        ]
      })
      .exec();

      return thread;
  }catch(error: any){
    throw new Error(`Failed to fetch thread by id: ${error.message}`)
  }
}