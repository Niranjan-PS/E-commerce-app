export const sendToken = (user, res, tokenName = 'userToken') => {
  const token = user.generateToken();

  const options = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: 'strict',
  };

  res.cookie(tokenName, token, options);

  
};
