// backend/controllers/walletController.js

import { Wallet } from "../../model/walletModel.js" 
import { User } from '../../model/userModel.js';
import { catchAsyncError } from "../../middlewares/catchAsync.js"; 
import crypto from 'crypto'; 

export const addReturnAmountToWallet = async (userId, amount, orderId) => {
    try {
        if (!userId || typeof amount !== 'number' || amount <= 0) {
            console.error("Invalid arguments for addReturnAmountToWallet:", { userId, amount, orderId });
            throw new Error('Invalid user ID or amount provided for wallet credit.');
        }
        let wallet = await Wallet.findOne({ userId });

        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0, transactions: [] });
            console.log(`New wallet created for user: ${userId}`);
        }
        wallet.balance += amount;
        const transactionId = `TRN-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        wallet.transactions.push({
            transactionId: transactionId,
            description: `Refund for Order #${orderId || 'N/A'}`, 
            amount: amount,
            date: new Date()
        });
        await wallet.save();
        console.log(`Amount ${amount} added to wallet for user ${userId}. New balance: ${wallet.balance}`);
        return wallet;
    } catch (error) {
        console.error(`Error adding amount to wallet for user ${userId}:`, error);
        throw error; 
    }
};

export const getWalletDetails = catchAsyncError(async (req, res, next) => {
    const userId = req.user._id;
    const wallet = await Wallet.findOne({ userId }).lean();
    if (!wallet) {
        return res.render('user/wallet', { 
            title: 'My Wallet',
            wallet: {
                balance: 0,
                transactions: []
            },
            user: req.user
        });
    }
    wallet.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.render('user/wallet', { 
        title: 'My Wallet',
        wallet: wallet,
        user: req.user
    });
});