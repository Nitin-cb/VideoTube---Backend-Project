import { Router } from "express";
import {
    UpdateAccountDetails,
    changeCurrentPassword,
    getCurrentUser,
    getUserChannelProfile,
    getWatchHistory,
    loginUser,
    logoutUser,
    refreshAccessToken,
    registerUser,
    updateUserAvatar,
    updateUserCoverImage
} from "../controllers/userController.js";
import {upload} from "../middlewares/multerMiddleware.js"
import { verfiyJwt } from "../middlewares/authMiddleware.js";
const router=Router()

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser)

//secured routes
router.route("/logout").post(verfiyJwt,logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change_password").post(verfiyJwt,changeCurrentPassword)
router.route("/current-user").post(verfiyJwt,getCurrentUser)

router.route("/update-account").patch(verfiyJwt,UpdateAccountDetails)
router.route("/avatar").patch(verfiyJwt,upload.single("avatar"),updateUserAvatar)
router.route("/cover-image").patch(verfiyJwt,upload.single("coverImage"),updateUserCoverImage)

router.route("/c/:username").get(verfiyJwt,getUserChannelProfile)
router.route("/history").get(verfiyJwt,getWatchHistory)


export default router