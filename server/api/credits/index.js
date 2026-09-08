const express = require('express');

const middleware = require('../../middleware');
const show = require('./show');
const awardSignupPromo = require('./award-signup-promo');
const spendForExchange = require('./spend-for-exchange');

const creditsRouter = express.Router();

creditsRouter.get('/', middleware.auth, show);
creditsRouter.post('/signup-promo', middleware.auth, awardSignupPromo);
creditsRouter.post('/spend-for-exchange', middleware.auth, spendForExchange);

module.exports = creditsRouter;
