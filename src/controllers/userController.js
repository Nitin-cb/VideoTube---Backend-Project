import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import {User} from "../models/userModel.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


const generateAccessAndRefreshTokens=async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken =  user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave:false })

        return {accessToken,refreshToken};
    } catch (error) {
        throw new ApiError(500,"Something went wrong while genrating refresh and access token")
    }
}
//............................
//get user details from frontend
//validation - not empty
//check if user already exist:username ,email
//check images ,check for avatar
//upload them to cloudinary,avatar
//create user object-create entry in db
//remove passwword and refresh token field from response
//check for user craetion
// return res

const registerUser=asyncHandler(async(req,res)=>{
    
//get user details from frontend
    const {fullname,email,username,password}=req.body
    console.log("email:",email);
    
//validation - not empty
    if(
        [fullname,email,username,password].some((field)=>field?.trim()==="")
    ){
        throw new ApiError(400,"all fields are reqiured")
    }

//check if user already exist:username ,email
    const existedUser=await User.findOne({
        $or:[{username},{email}]
    })
    if(existedUser){
        throw new ApiError(409,"user with email or username already exist")
    }
    console.log(req.files);

 //check images ,check for avatar
    const avatarLocalpath=req.files?.avatar[0]?.path;
    // const coverImageLocalpath=req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage)&&req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage[0].
        path
    }


    if(!avatarLocalpath){
        throw new ApiError(400,"Avatar file is required")
    }

//upload them to cloudinary,avatar
    const avatar=await uploadOnCloudinary(avatarLocalpath)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")

    }

//create user object-create entry in db
    const user=await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url||"",
        email,
        password,
        username:username.toLowerCase()
    })

//remove passwword and refresh token field from response
    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )

//check for user creation

    if(!createdUser){
        throw new ApiError(500,"something went wrong while registering user")
    }

// return res
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registed succesfully")
    )



})

const loginUser=asyncHandler(async (req,res)=>{
//req body ->data
const {email,username,password}=req.body
console.log(email);
//username or email
if(!(username || email)){
    throw new ApiError(400,"Username or email is required")
}

//find the user
const user =await User.findOne({
    $or:[{username},{email}]
})
// console.log(user);
if(!user){
    throw new ApiError(404,"User doesnot exist")
}

//password check
const isPasswordValid=await user.isPasswordCorrect(password)

if(!isPasswordValid){
    throw new ApiError(401,"password incorect")
}
//access and refresh token
const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id)
//send cookie
const loggedInUser=await User.findById(user._id).select("-password,-refreshToken")

const options={
    httpOnly:true,
    secure:true
}
//response
return res.status(200)
.cookie("accessToken",accessToken,options)
.cookie("refreshToken",refreshToken,options)
.json(
    new ApiResponse(200,{
        user:loggedInUser,accessToken,refreshToken
    },"user logged in succesfully")
)
})

const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:1
            }
        },
        {
            new:true
        }
    )

    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User loggedout"))
})

const refreshAccessToken=asyncHandler(async(req,res)=>{
    try {
        const incomingRefreshToken=req.cookies.refreshToken||req.body.refreshToken
        if(!incomingRefreshToken){
            throw new ApiError(401,"unauthorized request")
        }
    
        const decodedToken=jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        
        const user=await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401,"Invalid refresh token")
        }
    
        if(incomingRefreshToken!==user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired used")
        }
    
        const options={
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newRefreshToken}=await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken:newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message||"Invalid refresh token")
    }
})

const changeCurrentPassword=asyncHandler(async(req,res)=>{
    const{oldPassword,newPassword}=req.body

    // if(!(newPassword===confirmpassword)){

    // }

    const user=await User.findById(req.user?._id)
    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid Old Password")
    }
    user.password=newPassword
    await user.save({validateBeforeSave:false})
    return res.status(200).json(new ApiResponse(200,{},"password change succesfull"))
})

const getCurrentUser=asyncHandler(async(req,res)=>{
    return res.status(200).json(new ApiResponse(200,req.user,"current user fetched successfully"))
})

const UpdateAccountDetails=asyncHandler(async(req,res)=>{
    const {fullname,email}=req.body

    if(!fullname||!email){
        throw new ApiError(400,"All fields are required")

    }
    const user=await User.findByIdAndUpdate(req.user?._id,
        {$set:{
            fullname,
            email:email

        }},
        {new :true}
    ).select("-password")
    return res.status(200).json(new ApiResponse(200,user,"Account details updated successfully"))

})

const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalpath=req.file?.path;

    if(!avatarLocalpath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar= await uploadOnCloudinary(avatarLocalpath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(200,user,"Cover image updated successfull")
    )
})

const updateUserCoverImage=asyncHandler(async(req,res)=>{
    const coverLocalpath=req.file?.path;

    if(!coverLocalpath){
        throw new ApiError(400,"CoverImage file is missing")
    }

    const coverImage= await uploadOnCloudinary(coverLocalpath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on Cover image")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(200,user,"Cover image updated successfull")
    )
})


const getUserChannelProfile=asyncHandler(async(req,res)=>{
    const {username}=req.params

    if(!username?.trim()){
        throw new ApiError(400,"username is missing")
    }

    const channel=await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    //$size:"$subscribers"
                    $size: { $ifNull: ["$subscribers", []] }
                },
                channelsSubscribedToCount:{
                    // $size:"subscribedTo"
                    $size: { $ifNull: ["$subscribedTo", []] }
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullname:1,
                username:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ])
    console.log(channel);

    if(!channel?.length){
        throw new ApiError(404,"channel doesnot exists")
    }

    return res.status(200).json(new ApiResponse(200,channel[0],"User channel fetched succesfuly"))
})


const getWatchHistory=asyncHandler(async(req,res)=>{
    const user=await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
                // _id:new mongoose.Types.ObjectId.createFromHexString(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                            
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200).json(new ApiResponse(200,user[0].watchHistory,"Watch history fetched succesfully"))
})





export{registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    changeCurrentPassword,
    UpdateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}    



