var User = require('../models/user');
var access = require('./access');
var Challenge = require('../models/challenge');
var Arena = require('../models/arena');

module.exports = function(app, passport) {


    /**
     * Find challenge by id.
     *
     * @param {string} id
     * @returns {object} challenge
     */

    app.get('/api/challenges/:id', function(req, res, next) {
        Challenge.findOne({
            _id: req.params.id
        }).exec().then(function(model) {
            if (!model) return res.send(404, "Not Found");
            res.json({
                challenge: model
            });
        }, next);
    });

    /**
     * get all challenges.
     *
     * @param range
     * @returns {object} person
     */

    app.get('/api/challenges', function(req, res, next) {
        if(req.query.ids) {
            req.query._id = {$in:req.query.ids};
            delete req.query.ids;
        }
        Challenge.find(req.query, function(err, model) {
            if (err) return next(err);
            if (!model) return res.send(404, "Not Found");

            res.json({
                challenge: model
            });
        });
    });

    /**
     * post code.
     *
     * @returns {object} person
     */

    app.post('/api/challenges/run', function(req, res, next) {
        Challenge.run(req.body.code,req.body).spread(function (sterr,stout) {
            res.send({
                sterr:sterr,
                stout:stout
            });
        });
    });

    /**
     * test code.
     *
     * @returns {object} person
     */

    app.post('/api/challenges/test', function(req, res, next) {
        Challenge.test(req.body.code,req.body.challenge).spread(function (report,stout,sterr) {
            res.send({
                report:report,
                stout:stout,
                sterr:sterr
            });
        }).catch(function (err) {
            console.log(err);
            res.send(500,err.toString());
        });
    });


    /**
     * Create new challenges.
     *
     * @param range
     * @returns {object} person
     */

    app.post('/api/challenges', access.requireRole(['teacher','admin']), function(req, res, next) {
        req.body.challenge.author = req.user.id;
        Challenge.create(req.body.challenge, function(err, model) {
            if (err) return next(err);
            if (!model) return res.send(403, "Not Found");
            res.json({
                challenge: model
            });
        });
    });

    /**
     * Update new challenges.
     *
     * @param range
     * @returns {object} person
     */

    app.put('/api/challenges/:id', access.requireRole(['teacher','admin']), function(req, res, next) {
        Challenge.findOne({
            _id: req.params.id
        }).exec().then(function(model) {
            if (!model) return res.send(404, "Not Found");
            model.set(req.body.challenge);
            model.save(function(err, model) {
                res.json({
                    challenge: model
                });
            });
        }, next);
    });

    /**
     * Delete challenge.
     *
     * @param range
     * @returns {status} 200
     */

    app.del('/api/challenges/:id', access.requireRole(['teacher','admin']), function(req, res, next) {
        Challenge.findById(req.params.id, function(err, model) {
            if (err) return next(err);
            if(!model) return res.send(404);
            model.remove(function(err, model) {
                if (err) return next(err);
                res.send(200);
            });
        });
    });

};
