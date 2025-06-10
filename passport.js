import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from './model/userModel.js';
import dotenv from 'dotenv';

dotenv.config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
            
            if (!user.accountverified) {
                user.accountverified = true;
                await user.save();
            }
            // console.log('Existing Google user found:', user.email);
            // return done(null, user);
             if (user.isBlocked) {
        console.log('Blocked Google user tried to log in:', user.email);
        return done(null, false, { message: 'Your account is blocked' });
    }

    console.log('Existing Google user found:', user.email);
    return done(null, user);
        } else {
            // Create new user
            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                accountverified: true
            });

            await user.save();
            console.log('New Google user created:', user.email);
            return done(null, user);
        }
    } catch (err) {
        return done(err, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
       
        if (!user || user.isBlocked) {
            return done(null, false); 
        }
         done(null, user);

    } catch (err) {
        done(err, null);
    }
});

export default passport;
