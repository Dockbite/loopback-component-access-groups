'use strict';

const debug = require('debug')('loopback:componenet:access:context');
const loopback = require('loopback');
var Promise = require("bluebird");

module.exports = function userContextMiddleware() {
  // set current user to enable user access for remote methods
  return function userContext(req, res, next) {
    const loopbackContext = loopback.getCurrentContext();

    if (!loopbackContext) {
      debug('No user context (loopback current context not found)');
      return next();
    }

    if (!req.accessToken) {
      debug('No user context (access token not found)');
      return next();
    }

    loopbackContext.set('accessToken', req.accessToken.id);
    const app = req.app;
    const UserModel = app.accessUtils.options.userModel || 'User';
    const TeamModel = app.accessUtils.options.groupAccessModel || 'Team';


    return Promise.join(
      app.models[UserModel].findById(req.accessToken.userId),
      app.models[TeamModel].find({
        where: {
          userId: req.accessToken.userId
        }
      }),
      (user, groups) => {
        if (!user) {
          return next(new Error('No user with this access token was found.'));
        }
        loopbackContext.set('currentUser', user);
        loopbackContext.set('currentUserGroups', groups);
        debug('currentUser', user);
        debug('currentUserGroups', groups);
        return next();
      })
      .catch(next);
  };
};
