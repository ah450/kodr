var observer = require('../observer');
var util = require('util');
var User = require('../models/user');
var ExpiringToken = require('../models/expiringToken');
var Challenge = require('../models/challenge');
var mail = require('../config/mail');

exports.sockets = function (io) {
    
};

exports.model = function() {
    
/**
 * Event listner for when a trial is complete
 * @param  {Trial} trial trial that was just complete for the first time
 * @return {[type]}       [description]
 */
observer.on('trial.award', function(trial) {
    // console.log('user award hook caought in user', trial.user);
    User.findById(trial.user, function(err, user) {
        if (err) throw err;
        user.award('exp', trial.exp, trial);
    });
});
    /*
    observer.on('user.signup', function(user) {
        if (!user.isStudent) {
            ExpiringToken.toVerify(user).then(function(eToken) {
                var confirmURL = mail.host + '/confirmAccount/' + eToken._id;
                // template in views/mail
                return mail.renderAndSend('welcome.html', {
                    confirmURL: confirmURL
                }, {
                    to: user.email,
                    subject: 'You\'ve just signup for an awesome experience',
                    stub: process.env.NODE_ENV === 'test',
                }, function(err, info) {
                    if (err) throw err;
                    if (process.env.NODE_ENV === 'test') {
                        observer.emit('test.user.signup.response', {
                            token: eToken._id,
                            info: info
                        });
                    }
                });
            }).catch(function(err) {
                throw err;
            });
        } else {
            mail.send({
                to: mail.options.email,
                subject: 'A New Student just signed up',
                stub:process.env.NODE_ENV === 'test',
            }, function(err, info) {
                if (process.env.NODE_ENV === 'test') {
                    observer.emit('test.user.signup.response', {
                        info: info
                    });
                }
            });
        }
    });
    //*/
};