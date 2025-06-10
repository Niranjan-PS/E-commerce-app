export const sendToken = (user, res, tokenName = 'userToken') => {
  const token = user.generateToken();

  const options = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res.cookie(tokenName, token, options);

  
};
