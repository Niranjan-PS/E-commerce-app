import { Category } from "../../model/categoryModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import { Product } from "../../model/productModel.js";

export const categoryInfo = catchAsyncError(async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const message = req.query.message || null;
        const error = req.query.error || null;

        const categoryData = await Category.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);

        const startItem = skip + 1;
        const endItem = Math.min(skip + limit, totalCategories);


        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                categories: categoryData,
                currentPage: page,
                totalPages: totalPages
            });
        }

       
        res.render("admin/category", {
            categories: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            startItem: startItem,
            endItem: endItem,
            message: message,
            error: error,
            page: 'category'
        });

    } catch (error) {
        console.error("Error in categoryInfo:", error.message);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(500).json({ error: 'Failed to load categories' });
        }
        res.redirect("/admin/category?error=Failed+to+load+categories");
    }
});

export const addCategory = catchAsyncError(async (req, res, next) => {
  
    console.log("Request body:", req.body);

    try {
        
        const name = req.body?.name;
        const description = req.body?.description || '';

        console.log("Extracted name:", `"${name}"`);
        console.log("Extracted description:", `"${description}"`);
        console.log("Name type:", typeof name);
        console.log("Name length:", name ? name.length : 'undefined');

        // Server-side validation
        if (!name) {
            console.log("Category name is missing from request body");
            return res.redirect('/admin/category?error=Category+name+is+required');
        }

        const trimmedName = name.trim();
        if (!trimmedName) {
            console.log("Category name is empty or only whitespace");
            return res.redirect('/admin/category?error=Category+name+cannot+be+empty');
        }

        if (trimmedName.length < 2) {
            console.log("Category name is too short");
            return res.redirect('/admin/category?error=Category+name+must+be+at+least+2+characters');
        }

        if (trimmedName.length > 30) {
            console.log("Category name is too long");
            return res.redirect('/admin/category?error=Category+name+must+be+less+than+30+characters');
        }

        const trimmedDescription = description.trim();
        if (trimmedDescription.length > 100) {
            console.log("Description is too long");
            return res.redirect('/admin/category?error=Description+must+be+less+than+100+characters');
        }

        
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
        });

        if (existingCategory) {
            console.log("Category already exists:", trimmedName);
            return res.redirect('/admin/category?error=Category+already+exists');
        }

       
        const newCategory = new Category({
            name: trimmedName,
            description: trimmedDescription
        });

        await newCategory.save();
        console.log("Category added successfully:", newCategory);

        return res.redirect('/admin/category?message=Category+added+successfully');

    } catch (error) {
        console.error("Error in addCategory:", error);

        
        if (error.name === 'ValidationError') {
            const errorMessage = Object.values(error.errors).map(err => err.message).join(', ');
            return res.redirect(`/admin/category?error=${encodeURIComponent(errorMessage)}`);
        }

        
        if (error.code === 11000) {
            return res.redirect('/admin/category?error=Category+already+exists');
        }

        return res.redirect('/admin/category?error=Failed+to+add+category');
    }
});


export const toggleCategoryStatus = catchAsyncError(async (req, res, next) => {
    try {
        const { id } = req.params;
        const category = await Category.findById(id);

        if (!category) {
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(404).json({ success: false, message: 'Category not found' });
            }
            return res.redirect('/admin/category?error=Category+not+found');
        }


        category.isListed = !category.isListed;
        await category.save();


        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(200).json({
                success: true,
                message: 'Category status updated successfully',
                newStatus: category.isListed
            });
        }


        return res.redirect('/admin/category?message=Category+status+updated+successfully');

    } catch (error) {
        console.error("Error in toggleCategoryStatus:", error);

        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Failed to update category status' });
        }

        return res.redirect('/admin/category?error=Failed+to+update+category+status');
    }
});


export const getEditCategory =  catchAsyncError(async (req, res, next) =>{
    try {
        const id = req.query.id
        const category = await Category.findOne({_id:id})
        res.render("admin/edit-category",{category:category,
        message: req.query.message || null,
        error: req.query.error || null,
        page: 'category'
        })

    } catch (error) {
        res.redirect('/pageNotFound')
    }

})

export const EditCategory = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    console.log('Category ID:', id);
    console.log('Request Body:', req.body);

    const category = await Category.findById(id);
    console.log('Found Category:', category);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }


    const existingCategory = await Category.findOne({
      name: name,
      _id: { $ne: id }
    });
    console.log('Existing Category with Name:', existingCategory);
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category exists, please choose another name"
      });
    }


    const updateCategory = await Category.findByIdAndUpdate(
      id,
      {
        name:name,
        description: description
      },
      { new: true }
    );

    if (updateCategory) {
      return res.status(200).json({
        success: true,
        message: "Category updated successfully"
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }
  } catch (err) {
    console.error("Error updating category:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});



export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({ message: 'Category ID is required' });
      }
      return res.redirect('/admin/category?error=Category+ID+is+required');
    }

    const category = await Category.findByIdAndDelete(id);
   
    if (!category) {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(404).json({ message: 'Category not found' });
      }
      return res.redirect('/admin/category?error=Category+not+found');
    }
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ message: 'Category deleted successfully' });
    }



    // // Example: Delete products with quantity < 5 and price < 1000
    // await Product.deleteMany({
    //   $and: [
    //     { quantity: { $lt: 5 } },
    //     { price: { $lt: 1000 } }
    //   ]
    // });


    res.redirect('/admin/category?message=Category+deleted+successfully');
  } catch (error) {
    console.error('Error deleting category:', error.message);


    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({ message: 'Failed to delete category' });
    }

    res.redirect('/admin/category?error=Failed+to+delete+category');
  }
};