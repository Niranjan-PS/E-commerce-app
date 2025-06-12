import {User} from '../../model/userModel.js'
import { catchAsyncError } from "../../middlewares/catchAsync.js";

export const customerInfo = catchAsyncError(async (req, res, next) => {
  try {
    const search = req.query.search || "";
    const status = req.query.status || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;


    const query = {
      isAdmin: false,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    };


    if (status === 'active') {
      query.isBlocked = false;
    } else if (status === 'blocked') {
      query.isBlocked = true;
    }

    // Get paginated user data and total count for pagination
    const [userData, total] = await Promise.all([
      User.find(query)
        .limit(limit)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 })
        .exec(),
      User.countDocuments(query)
    ]);

    // Get actual statistics from the entire user collection 
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalUsers, activeUsers, blockedUsers, newTodayUsers] = await Promise.all([
      User.countDocuments({ isAdmin: false }),
      User.countDocuments({ isAdmin: false, isBlocked: false }),
      User.countDocuments({ isAdmin: false, isBlocked: true }),
      User.countDocuments({
        isAdmin: false,
        createdAt: {
          $gte: today,
          $lt: tomorrow
        }
      })
    ]);

    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.min(Math.max(page, 1), totalPages);

    
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json');

    if (isAjax) {
      return res.json({
        success: true,
        users: userData,
        totalPages,
        currentPage,
        totalUsers: total,
        search,
        status,
        userStats: {
          totalUsers,
          activeUsers,
          blockedUsers,
          newTodayUsers
        }
      });
    }

    res.render('admin/users', {
      user: userData,
      totalPages,
      currentPage,
      search,
      status,
      message: userData.length === 0 ? "No users found." : null,
      
      userStats: {
        totalUsers,
        activeUsers,
        blockedUsers,
        newTodayUsers
      }
    });

  } catch (error) {
    console.error("Error loading users:", error);
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json');
    if (isAjax) {
      return res.status(500).json({
        success: false,
        message: "Server error while loading users"
      });
    }
    next(error);
  }
});