import HttpStatus from '../helpers/httpStatus.js';

class ErrorHandler extends Error{
    constructor(message,statusCode){
        super(message)
        this.statusCode=statusCode

    }
}
export const errorMiddleware=(err,req,res,next)=>{
    err.statusCode=err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
    err.message = err.message

    console.log(err.message,"this is the err")
    if(err.name ==="CastError"){
        const message=`invalid ${err.path}`
        err= new ErrorHandler(message,HttpStatus.BAD_REQUEST);
    }
    if(err.name ==="JsonWEbTokenError"){
        const message=`invalid Token, Try again`
        err= new ErrorHandler(message,HttpStatus.BAD_REQUEST);
    }
    if(err.name ==="TokenExpiredError"){
        const message=` sorry! token expired `
        err= new ErrorHandler(message,HttpStatus.BAD_REQUEST);
    }
    if(err.code ===11000){
        const message=`duplicate ${Object.keys(err.keyValue)} entered`
        err= new ErrorHandler(message,HttpStatus.BAD_REQUEST);
    }
    return res.status(err.statusCode).json({
        success:false,
        message:err.message
    })
}
export default ErrorHandler;