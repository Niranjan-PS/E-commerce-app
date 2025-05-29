

export const sendToken =  (user,res)=>{
 
    const token =  user.generateToken()
   
      res.cookie("token",token,{
        expires: new Date(Date.now() + 15 * 60 * 1000),
        httpOnly:true,
        
    })
   
}