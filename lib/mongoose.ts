// This file is used to connect to MongoDB using mongoose

import mongoose from 'mongoose';

let isConnected = false; // variable to check if mongoose is connected

export const connectToDB = async () => {
    mongoose.set('strictQuery', true);  // to prevent unknown field query

    if(!process.env.MONGODB_URL) return console.log('MongoDB URl not found');

    if(isConnected) return console.log('Already connected to MONGODB');

    try{
        await mongoose.connect(process.env.MONGODB_URL);
        isConnected = true;
        console.log("Connected to MongoDB");
    }catch(error){
        console.log(error);
    }
}