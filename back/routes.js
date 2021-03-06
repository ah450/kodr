var Promise = require('bluebird');
var log = require('util').log;
var observer = require('./observer');
var User = require('./models/user');
var ExpiringToken = require('./models/expiringToken');
var access = require('./routes/access');
var Challenge = require('./models/challenge');
var mail = require('./config/mail');

module.exports = function(app, passport) {

    // challenge routes
    require('./routes/challenge')(app, passport);
    // trial routes
    require('./routes/trial')(app, passport);
    // arena routes
    require('./routes/arena')(app, passport);
    // arena trial routes
    require('./routes/arenaTrial')(app, passport);
    // user routes
    require('./routes/user')(app, passport);
    // group routes
    require('./routes/group')(app, passport);
    // member routes
    require('./routes/member')(app, passport);
    // quest routes
    require('./routes/quest')(app, passport);
    // userQuest routes
    require('./routes/userQuest')(app, passport);

    if (process.env.NODE_ENV !== 'production') {
        app.get('/seed_db', require('./seed_db'));
    }

    /**
     * POST /token
     * Sign in using identification and password.
     * @param {string} username
     * @param {string} password
     */

    app.post('/token', function(req, res, next) {
        if (process.env.NODE_ENV === "development") {
            User.findByIdentity(req.body.username).then(function(user) {
                if (user) {
                    if (!user.activated) return res.send(400, {
                        message: 'This account is not Verified',
                        id: user.id,
                        email: user.email
                    });
                    observer.emit('user.login', user);
                    res.send({
                        access_token: user.token,
                        user_id: user._id
                    });
                } else res.send(403, {
                    message: 'Incorrect username or password.'
                });
            });
        } else {
            passport.authenticate('local-login', function(err, user) {
                if (err) return next(err);
                if (user) {
                    if (!user.activated) return res.send(400, {
                        message: 'This account is not Verified',
                        id: user.id,
                        email: user.email
                    });
                    observer.emit('user.login', user);
                    res.send({
                        access_token: user.token,
                        user_id: user._id
                    });
                } else res.send(403, {
                    message: 'Incorrect username or password.'
                });
            })(req, res, next);
        }
    });

    // logout
    app.del('/logout', access.hasToken, function(req, res) {
        observer.emit('user.logout', req.user);
        req.logout();
        res.send(204);
    });

    // confirmAccount after recieving verifcation
    app.get('/verify/:token', function(req, res, next) {
        ExpiringToken.useToken(req.params.token).then(function(token) {
            if (token) {
                User.findOne({
                    _id: token.user
                }).exec().then(function(user) {
                    user.activated = true;
                    user.save();
                    observer.emit('user.verified', user);
                    res.render('confirm.html', {
                        user: user
                    });
                }, next);
            } else {
                res.render("expiredToken.html");
            }
        }, next);
    });

    // render forgot password page
    app.get('/forgotpass/:token', function(req, res, next) {
        ExpiringToken.getToken(req.params.token).then(function(token) {
            if (token) {
                res.render('forgotPassword.html', {
                    token: token.id
                });
            } else {
                res.render("expiredToken.html");
            }
        }, next);
    });

    // reset forgot password page
    app.post('/forgotpass', function(req, res, next) {
        ExpiringToken.getToken(req.body.token).then(function(token) {
            if (token) {
                return Promise.fulfilled().then(function() {
                    return User.findOne({
                        _id: token.user
                    }).exec();
                }).then(function(user) {
                    if (req.body.password !== req.body.passwordConfirmation) {
                        throw {
                            http_code: 400,
                            message: 'Passwords do not match.'
                        };
                    }
                    user.password = req.body.password;
                    user.save(function(err, user) {
                        if (err) throw err;
                        res.render('confirm.html', {
                            user: user,
                        });
                        ExpiringToken.useToken(token.id);
                    });
                });
            } else {
                res.render("expiredToken.html");
            }
        }).catch(function(err) {
            if (err.http_code) {
                return res.send(err.http_code, err.message);
            }
            next(err);
        });
    });


    /**
     * POST /signup
     * Create a new local account.
     * @param {string} username
     * @param {string} email
     * @param {string} password
     * @param {string} confirmPassword
     */

    app.post('/signup', function(req, res, next) {
        Promise.fulfilled()
            .then(validateRequestBody(req))
            .then(findUser(req))
            .then(createIfNewUser(req))
            .then(emitAndRespond(req, res))
            .catch(function(err) {
                console.log(err.stack);
                if (err.http_code) {
                    return res.send(err.http_code, err.message);
                }
                res.send(500, err.message);
            });

        function validateRequestBody(req) {
            return function() {
                if (!req.body.username) {
                    throw {
                        http_code: 400,
                        message: 'Username cannot be blank.'
                    };
                }
                if (req.body.uniId && !/^\d+\-\d{3,5}$/.test(req.body.uniId)) {
                    throw {
                        http_code: 400,
                        message: 'Invalid Uni ID'
                    };
                }
                if (!req.body.email) {
                    throw {
                        http_code: 400,
                        message: 'Email cannot be blank.'
                    };
                }
                if (!req.body.password) {
                    throw {
                        http_code: 400,
                        message: 'Password cannot be blank.'
                    };
                }

                if (req.body.password !== req.body.passwordConfirmation) {
                    throw {
                        http_code: 400,
                        message: 'Passwords do not match.'
                    };
                }

                if (!(/^.+@.+\..+$/.test(req.body.email) || /^\S+\.\S+@guc\.edu\.eg$/.test(req.body.email) || /^\S+\.\S+@student\.guc\.edu\.eg$/.test(req.body.email))) {
                    throw {
                        http_code: 401,
                        message: 'Invalid Email'
                    };
                }
            };
        }

        function findUser(req) {
            return function() {
                return User.findOne({
                    $or: [{
                        'username': req.body.username
                    }, {
                        'email': req.body.email,
                    }]
                }).exec();
            };
        }

        function createIfNewUser(req) {
            return function(user) {
                if (user) {
                    throw {
                        http_code: 400,
                        message: 'User already exists'
                    };
                }

                var role = getRoleByEmail(req.body.email);

                return User.create({
                    username: req.body.username,
                    email: req.body.email,
                    uniId: req.body.uniId,
                    password: req.body.password,
                    role: role,
                    activated: false
                });
            };
        }


        function getRoleByEmail(email) {
            if (/^\S+\.\S+@guc\.edu\.eg$/.test(email)) {
                return 'teacher';
            } else if (/^\S+\.\S+@student\.guc\.edu\.eg$/.test(email)) {
                return 'student';
            }
            return 'student';
        }

        function emitAndRespond(req, res) {
            if (process.env.NODE_ENV === 'test') {
                return function(user) {
                    observer.emit('user.signup', user);
                    observer.once('test.user.signup.response', function(body) {
                        res.send(body);
                    });
                };
            } else {
                return function(user) {
                    observer.emit('user.signup', user);
                    res.send(200, "Check your email for verification");
                };
            }
        }
    });

    app.get('/pull/master', function(req,res) {
        var exec = require('child_process').exec;
        exec('./pull.sh', {
            cwd: __dirname + '/..',
            env: process.env
        }, function (err, stout,sterr) {
            if(err) {
                log("failed to complete pull request");
                log(err);
                log(stout);
                log(sterr);
                return res.send(500);
            }
            if (sterr) {
                log(sterr);
                return res.send(500);
            }
            log("pull complete");
            return res.send(200);
        });
    });
};
