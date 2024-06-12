import { Router } from "express";
import { loginUser, logoutUser, refreshAccessToken, registerUser } from "../controllers/userController.js";
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


export default router