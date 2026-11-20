const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CONFIG = {
  SSL_STORE_ID: 'আপনার_SSLCOMMERZ_STORE_ID',
  SSL_STORE_PASS: 'আপনার_SSLCOMMERZ_PASSWORD',
  SSL_IS_LIVE: false,
  NOWPAYMENTS_API_KEY: 'আপনার_NOWPAYMENTS_API_KEY',
  FRONTEND_URL: 'https://your-game-website.com',
  BACKEND_URL: 'https://onrender.com'
};

let userBalances = { 'USER_101': 0.00 };
let transactions = {};

app.get('/api/user/balance/:userId', (req, res) => {
  const bal = userBalances[req.params.userId] || 0;
  res.json({ success: true, balance: bal });
});

app.post('/api/payment/unified/create', async (req, res) => {
  const { userId, methodId, provider, amount } = req.body;
  const tran_id = 'TXN_' + Date.now();

  transactions[tran_id] = {
    userId,
    amount: parseFloat(amount),
    status: 'PENDING'
  };

  try {
    if (provider === 'sslcommerz') {
      const apiUrl = CONFIG.SSL_IS_LIVE
        ? 'https://sslcommerz.com'
        : 'https://sslcommerz.com';

      const formData = new URLSearchParams({
        store_id: CONFIG.SSL_STORE_ID,
        store_passwd: CONFIG.SSL_STORE_PASS,
        total_amount: amount * 120,
        currency: 'BDT',
        tran_id: tran_id,
        success_url: `${CONFIG.BACKEND_URL}/api/payment/verify?tran_id=${tran_id}`,
        fail_url: `${CONFIG.FRONTEND_URL}?payment=failed`,
        cancel_url: `${CONFIG.FRONTEND_URL}?payment=cancelled`,
        cus_name: userId,
        cus_email: 'user@xcrash.com',
        cus_phone: '01700000000',
        shipping_method: 'NO',
        product_name: `Deposit via ${methodId}`,
        product_category: 'Gaming',
        product_profile: 'general'
      });

      const response = await axios.post(apiUrl, formData);
      if (response.data && response.data.GatewayPageURL) {
        return res.json({ checkoutUrl: response.data.GatewayPageURL });
      }
    } else {
      const response = await axios.post('https://nowpayments.io', {
        price_amount: amount,
        price_currency: 'usd',
        order_id: tran_id,
        order_description: `Deposit via ${methodId}`,
        success_url: `${CONFIG.BACKEND_URL}/api/payment/verify?tran_id=${tran_id}`,
        cancel_url: `${CONFIG.FRONTEND_URL}?payment=cancelled`
      }, {
        headers: { 'x-api-key': CONFIG.NOWPAYMENTS_API_KEY }
      });

      if (response.data && response.data.invoice_url) {
        return res.json({ checkoutUrl: response.data.invoice_url });
      }
    }

    res.status(400).json({ message: 'গেটওয়ে থেকে লিংক পাওয়া যায়নি' });
  } catch (error) {
    res.status(500).json({ message: 'সার্ভার এরর' });
  }
});

app.all('/api/payment/verify', (req, res) => {
  const tran_id = req.query.tran_id || req.body.tran_id;
  const txn = transactions[tran_id];

  if (txn && txn.status === 'PENDING') {
    txn.status = 'COMPLETED';
    userBalances[txn.userId] = (userBalances[txn.userId] || 0) + txn.amount;
    return res.redirect(`${CONFIG.FRONTEND_URL}?payment=success`);
  }
  res.redirect(`${CONFIG.FRONTEND_URL}?payment=invalid`);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));