import mongoose from 'mongoose';

const connection = () => {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log('MongoDB connected successfully');
    })
    .catch((err) => {
      console.log('Error connecting to MongoDB:', err.message);
    });
};

export { connection };
