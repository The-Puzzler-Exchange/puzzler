const express = require('express');
const middleware = require('../../middleware');
const shippingRates = require('./shipping-rates');

const router = express.Router();

router.post('/shipping-rates', middleware.auth, shippingRates);

module.exports = router;
