/*
 * auth.js
 */

var User = require('../models/user')
var Campaign = require('../models/campaign')
var authHelpers = require('./auth-helpers')

module.exports = function(app) {
  app.post('/api/auth/login', function(req, res) {
    console.log("logging in")
    User.findOne({ email: req.body.email }, '+password', function(err, user) {
      console.log(user)
      if (!user) {
        return res.status(401).send({ message: 'Wrong email and/or password' });
      }
      user.comparePassword(req.body.password, function(err, isMatch) {
        if (!isMatch) {
          return res.status(401).send({ message: 'Wrong email and/or password' });
        }
        res.send({ token: authHelpers.createJWT(user) });
      });
    });
  });

  app.post('/api/auth/signup', function(req, res) {
    User.findOne({ email: req.body.email }, function(err, existingUser) {
      if (existingUser) {
        return res.status(409).send({ message: 'Email is already taken' });
      }
      if (req.body.password !== req.body.password_confirm) {
        return res.status(409).send({ message: 'Passwords do not match' }); 
      }
      var user = new User({
        email: req.body.email,
        password: req.body.password
      });
      user.save(function(err, user) {
        if (err) {
          res.status(400).send({ message: "Validation error saving user" });  
        } else {
          res.status(201).send({ token: authHelpers.createJWT(user), _id: user._id });  
        }
      });
    });
  });


  /*
   |--------------------------------------------------------------------------
   | Login with Facebook
   |--------------------------------------------------------------------------
   */
  app.post('/api/auth/facebook', function(req, res) {
    var accessTokenUrl = 'https://graph.facebook.com/v2.3/oauth/access_token';
    var graphApiUrl = 'https://graph.facebook.com/v2.3/me';
    var params = {
      code: req.body.code,
      client_id: req.body.clientId,
      client_secret: config.FACEBOOK_SECRET,
      redirect_uri: req.body.redirectUri
    };

    // Step 1. Exchange authorization code for access token.
    request.get({ url: accessTokenUrl, qs: params, json: true }, function(err, response, accessToken) {
      if (response.statusCode !== 200) {
        return res.status(500).send({ message: accessToken.error.message });
      }

      // Step 2. Retrieve profile information about the current user.
      request.get({ url: graphApiUrl, qs: accessToken, json: true }, function(err, response, profile) {
        if (response.statusCode !== 200) {
          return res.status(500).send({ message: profile.error.message });
        }
        if (req.headers.authorization) {
          User.findOne({ facebook: profile.id }, function(err, existingUser) {
            if (existingUser) {
              return res.status(409).send({ message: 'There is already a Facebook account that belongs to you' });
            }
            var token = req.headers.authorization.split(' ')[1];
            var payload = jwt.decode(token, config.TOKEN_SECRET);
            User.findById(payload.sub, function(err, user) {
              if (!user) {
                return res.status(400).send({ message: 'User not found' });
              }
              user.facebook = profile.id;
              user.picture = user.picture || 'https://graph.facebook.com/v2.3/' + profile.id + '/picture?type=large';
              user.displayName = user.displayName || profile.name;
              user.save(function() {
                var token = authHelpers.createJWT(user);
                res.send({ token: token });
              });
            });
          });
        } else {
          // Step 3b. Create a new user account or return an existing one.
          User.findOne({ facebook: profile.id }, function(err, existingUser) {
            if (existingUser) {
              var token = authHelpers.createJWT(existingUser);
              return res.send({ token: token });
            }
            var user = new User();
            user.facebook = profile.id;
            user.picture = 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
            user.displayName = profile.name;
            user.save(function() {
              var token = authHelpers.createJWT(user);
              res.send({ token: token });
            });
          });
        }
      });
    });
  });

  
  /*
   |--------------------------------------------------------------------------
   | Login with Twitter
   |--------------------------------------------------------------------------
   */
  app.post('/api/auth/twitter', function(req, res) {
    var requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
    var accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
    var profileUrl = 'https://api.twitter.com/1.1/users/show.json?screen_name=';

    // Part 1 of 2: Initial request from Satellizer.
    if (!req.body.oauth_token || !req.body.oauth_verifier) {
      var requestTokenOauth = {
        consumer_key: config.TWITTER_KEY,
        consumer_secret: config.TWITTER_SECRET,
        callback: req.body.redirectUri
      };

      // Step 1. Obtain request token for the authorization popup.
      request.post({ url: requestTokenUrl, oauth: requestTokenOauth }, function(err, response, body) {
        var oauthToken = qs.parse(body);

        // Step 2. Send OAuth token back to open the authorization screen.
        res.send(oauthToken);
      });
    } else {
      // Part 2 of 2: Second request after Authorize app is clicked.
      var accessTokenOauth = {
        consumer_key: config.TWITTER_KEY,
        consumer_secret: config.TWITTER_SECRET,
        token: req.body.oauth_token,
        verifier: req.body.oauth_verifier
      };

      // Step 3. Exchange oauth token and oauth verifier for access token.
      request.post({ url: accessTokenUrl, oauth: accessTokenOauth }, function(err, response, accessToken) {

        accessToken = qs.parse(accessToken);

        var profileOauth = {
          consumer_key: config.TWITTER_KEY,
          consumer_secret: config.TWITTER_SECRET,
          oauth_token: accessToken.oauth_token
        };

        // Step 4. Retrieve profile information about the current user.
        request.get({
          url: profileUrl + accessToken.screen_name,
          oauth: profileOauth,
          json: true
        }, function(err, response, profile) {

          // Step 5a. Link user accounts.
          if (req.headers.authorization) {
            User.findOne({ twitter: profile.id }, function(err, existingUser) {
              if (existingUser) {
                return res.status(409).send({ message: 'There is already a Twitter account that belongs to you' });
              }

              var token = req.headers.authorization.split(' ')[1];
              var payload = jwt.decode(token, config.TOKEN_SECRET);

              User.findById(payload.sub, function(err, user) {
                if (!user) {
                  return res.status(400).send({ message: 'User not found' });
                }

                user.twitter = profile.id;
                user.displayName = user.displayName || profile.name;
                user.picture = user.picture || profile.profile_image_url.replace('_normal', '');
                user.save(function(err) {
                  res.send({ token: authHelpers.createJWT(user) });
                });
              });
            });
          } else {
            // Step 5b. Create a new user account or return an existing one.
            User.findOne({ twitter: profile.id }, function(err, existingUser) {
              if (existingUser) {
                return res.send({ token: authHelpers.createJWT(existingUser) });
              }

              var user = new User();
              user.twitter = profile.id;
              user.displayName = profile.name;
              user.picture = profile.profile_image_url.replace('_normal', '');
              user.save(function() {
                res.send({ token: authHelpers.createJWT(user) });
              });
            });
          }
        });
      });
    }
  });

  /*
   |--------------------------------------------------------------------------
   | GET /api/me
   |--------------------------------------------------------------------------
   */
  app.get('/api/me', authHelpers.ensureAuthenticated, function(req, res) {
    User.findById(req.user).populate('campaigns').populate('drafts').exec(function(err, user) {
      Campaign.populate(user, {path:'campaigns.articles', model:'Article' }, function(err, data) {
        if (err) { return res.status(404).send(err) };
        res.status(200).json(user); 
      });
    });
  });

  /*
   |--------------------------------------------------------------------------
   | PUT /api/me
   |--------------------------------------------------------------------------
   */
  app.put('/api/me', authHelpers.ensureAuthenticated, function(req, res) {
    console.log(req.user)
    console.log(req.body)
    User.findByIdAndUpdate(req.user, req.body, function(err, user) {
      console.log(user)
      if (!user) {
        return res.status(400).send({ message: 'User not found' });
      } else if (err) {
        return res.status(400).send({ message: 'There was a problem updating your profile' });
      } else {
        return res.status(200).send(user);
      }
    });
  });
}