import { app } from './app.js';
import { connection } from './db.js'; 
import { ProductOffer } from './model/productOfferModel.js';

connection(); 

// Auto-disable expired offers every hour
setInterval(async () => {
  try {
    const disabledCount = await ProductOffer.disableExpiredOffers();
    if (disabledCount > 0) {
      console.log(`Auto-disabled ${disabledCount} expired product offers`);
    }
  } catch (error) {
    console.error('Error auto-disabling expired offers:', error);
  }
}, 60 * 60 * 1000); // Run every hour

// Initial check on server start
(async () => {
  try {
    const disabledCount = await ProductOffer.disableExpiredOffers();
    if (disabledCount > 0) {
      console.log(`Disabled ${disabledCount} expired product offers on startup`);
    }
  } catch (error) {
    console.error('Error checking expired offers on startup:', error);
  }
})();

app.listen(process.env.PORT || 4003, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
