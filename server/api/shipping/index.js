const express = require('express');
const middleware = require('../../middleware');
const createPaymentIntent = require('./create-payment-intent');
const refundPaymentIntent = require('./refund-payment-intent');
const buyLabel = require('./buy-label');

const router = express.Router();

router.post('/create-payment-intent', middleware.auth, createPaymentIntent);
router.post('/refund-payment-intent', middleware.auth, refundPaymentIntent);
router.post('/buy-label', middleware.auth, buyLabel);

module.exports = router;
