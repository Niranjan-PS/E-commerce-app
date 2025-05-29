import {User} from '../model/userModel.js'
import { catchAsyncError } from "../middlewares/catchAsync.js";

export const customerInfo = catchAsyncError(async (req, res, next) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;

    // Query for users with pagination
    const query = {
      isAdmin: false,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    };

    const [userData, total] = await Promise.all([
      User.find(query)
        .limit(limit)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 })
        .exec(),
      User.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.min(Math.max(page, 1), totalPages); 

    res.render('users', {
      user: userData,
      totalPages,
      currentPage,
      search,
      message: userData.length === 0 ? "No users found." : null
    });

  } catch (error) {
    next(error); 
  }
});