const mongoose = require('mongoose');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/stockDB', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

connectDB();

// Stock Schema
const StockSchema = new mongoose.Schema({
  symbol: String,
  data: Array,
  lastUpdated: Date,
});

const Stock = mongoose.model('Stock', StockSchema);

const deleteAllRecords = async () => {
  try {
    await Stock.deleteMany({});
    console.log('All records deleted successfully');
    mongoose.connection.close();
  } catch (err) {
    console.error('Error deleting records:', err.message);
  }
};

deleteAllRecords();
