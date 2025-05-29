import { app } from './app.js';
import { connection } from './db.js'; 

connection(); 

app.listen(process.env.PORT || 4003, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
