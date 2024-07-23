const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;
const RAPID_API_KEY = '97c52bd795mshf5b1576986b409dp1f4057jsn2be6b9ed382e';
const RAPID_API_HOST = 'apidojo-yahoo-finance-v1.p.rapidapi.com';

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
  data: [
    {
      timestamp: Number,
      high: Number,
      open: Number,
      low: Number,
      close: Number,
      volume: Number,
    },
  ],
  lastUpdated: Date,
});

const Stock = mongoose.model('Stock', StockSchema);

app.use(express.json());

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Update stock data
app.post('/api/updateStockData', async (req, res) => {
  const { symbol } = req.body;

  try {
    let stock = await Stock.findOne({ symbol });

    const options = {
      method: 'GET',
      url: `https://${RAPID_API_HOST}/stock/v3/get-chart`,
      params: {
        interval: '1d',
        range: '5y',
        region: 'US',
        symbol,
        useYfid: true,
        includeAdjustedClose: true,
      },
      headers: {
        'x-rapidapi-key': RAPID_API_KEY,
        'x-rapidapi-host': RAPID_API_HOST,
      },
      timeout: 10000, // 10 seconds timeout
    };

    console.log(`Requesting data for ${symbol}...`);
    const response = await axios.request(options);
    console.log(`Data received for ${symbol}`);
    const chartData = response.data.chart.result[0];
    const data = chartData.indicators.quote[0];
    const timestamps = chartData.timestamp;

    const newData = timestamps.map((timestamp, index) => ({
      timestamp,
      high: data.high[index],
      open: data.open[index],
      low: data.low[index],
      close: data.close[index],
      volume: data.volume[index],
    }));

    const newLastUpdated = new Date(timestamps[timestamps.length - 1] * 1000);

    if (stock) {
      // Filter out duplicate timestamps
      const existingTimestamps = new Set(stock.data.map(item => item.timestamp));
      const filteredNewData = newData.filter(item => !existingTimestamps.has(item.timestamp));

      stock.data.push(...filteredNewData);
      stock.lastUpdated = newLastUpdated;
      await stock.save();
    } else {
      stock = await Stock.create({
        symbol,
        data: newData,
        lastUpdated: newLastUpdated,
      });
    }

    res.json({ message: 'Stock data updated successfully' });
  } catch (error) {
    if (error.response) {
      console.error(`Request error (${error.response.status}):`, error.response.data);
      if (error.response.status === 429) {
        console.error('Rate limit exceeded. Retrying after delay...');
        await delay(60000); // Wait for 1 minute before retrying
      } else if (error.response.status === 403) {
        console.error('Forbidden request. Check API key and subscription status.');
      }
    } else {
      console.error('Request error:', error.message);
    }

    res.status(500).send('Server Error');
  }
});

// Get stock data
app.post('/api/getStockData', async (req, res) => {
  const { symbol, startDate, endDate } = req.body;

  try {
    const stock = await Stock.findOne({ symbol });

    if (!stock) {
      return res.status(404).json({ message: 'Stock not found' });
    }

    const start = new Date(startDate).getTime() / 1000;
    const end = new Date(endDate).getTime() / 1000;

    const dataInRange = stock.data.filter(
      (data) => data.timestamp >= start && data.timestamp <= end
    );

    console.log('Data in range:', dataInRange); // Log the data in range to inspect

    const highestValue = Math.max(...dataInRange.map((data) => data.high));
    const lowestValue = Math.min(...dataInRange.map((data) => data.low));

    res.json({
      symbol,
      highestValue: isFinite(highestValue) ? highestValue : null,
      lowestValue: isFinite(lowestValue) ? lowestValue : null,
      dataInRange,
    });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).send('Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
