const { getTrustedSdk, handleError } = require('../api-util/sdk');

async function auth(req, res, next) {
  try {
    const trustedSdk = await getTrustedSdk(req);
    const userResponse = await trustedSdk.currentUser.show();
    const currentUser = userResponse?.data?.data;
    if (!currentUser) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    req.tokenUserId = currentUser.id.uuid;
    req.email = currentUser.attributes.email;

    next();
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = auth;
