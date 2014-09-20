/*globals before,after,beforeEach,afterEach,describe,it */
var Promise = require('bluebird');
var should = require('chai').should();
var assert = require('chai').assert;
var expect = require('chai').expect;
var request = require('supertest');
var setup = require('./setup');
var observer = require('../../back/mediator');
var Challenge = require('../../back/models/challenge');
var Arena = require('../../back/models/arena');
var ArenaTrial = require('../../back/models/arenaTrial');
var Trial = require('../../back/models/trial');
var User = require('../../back/models/user');



describe('Challenge', function() {
    before(setup.clearDB);

    var code = 'char c =\'a\'; int a = 40, b = 20; System.out.print("a - b = " + (a - b));';
    var testchallenge = {
        language:'java',
        tests: '\
  if ($userOut.toString().equals("a - b = 20")) {\
    Test.pass("you did it!");\
  } else {\
   Test.fail("it\'s "+$userOut.toString()+" to equal "+"a - b = 20"); \
  }',
        postCode:'//comment won\'t be striped\n char y = \'1\';',
        preCode:'//comment to be striped',
        exp:1
    };
    var out = "a - b = 20";

    describe('Code', function() {
        it('should run java', function(done) {
            Challenge.run(code,'java').spread(function(sterr, stout) {
                if (sterr) return done(sterr);
                stout.should.equal(out);
                done();
            }).catch(done);
        });
        it('should run java and show error', function(done) {
            Challenge.run(code+'\n x = 3','java').spread(function(sterr, stout) {
                sterr.should.exist;
                // stout.should.equal(out);
                done();
            }).catch(done);
        });

        it('should test java', function(done) {
            Challenge.test(code,testchallenge,'java').spread(function(report, stout, sterr) {
                if(sterr) return done(sterr);
                // console.log(stout);
                expect(report).to.have.property('passed',true);
                done();
            }).catch(done);
        });
    });
    describe('Trials', function() {
        var challenge, arenaTrial, trials, user, num = 10;
        beforeEach(function(done) {
            Promise.fulfilled()
                .then(function() {
                    var at = ArenaTrial.create({});
                    var ch = Challenge.create({});
                    var ch2 = Challenge.create({});
                    var usr = User.create({
                        username: 'testuser',
                        password: 'testuser12'
                    });
                    return [at, ch, ch2, usr];
                })
                .spread(function(at, ch, ch2, usr) {
                    challenge = ch;
                    arenaTrial = at;
                    user = usr;
                    var arr = Array(num);
                    var chs = Promise.each(arr, function() {
                        return Trial.create({
                            challenge: ch._id,
                            arenaTrial: at._id,
                            user: usr
                        });
                    });
                    var chs2 = Promise.each(arr, function() {
                        return Trial.create({
                            challenge: ch2._id,
                            arenaTrial: at._id,
                            user: usr

                        });
                    });

                    return [chs, chs2];
                }).spread(function(chs, chs2) {
                    trials = chs.concat(chs2);
                    return [
                        ArenaTrial.findOne({
                            _id: arenaTrial._id
                        }).exec(),
                        Challenge.findOne({
                            _id: challenge._id
                        }).exec()
                    ];
                }).spread(function(at, ch) {
                    arenaTrial = at;
                    challenge = ch;
                })
                .finally(done);
        });
        afterEach(setup.clearDB);
        it('should remove themselves from their arenaTrial after cahllenge is removed', function(done) {
            trials.length.should.equal(num * 2);
            arenaTrial.trials.length.should.equal(num * 2);
            challenge.trials.length.should.equal(num);
            observer.on('test.challenge.trials.removed', function(arenaTrialTrials, challengeTrials) {
                expect(arenaTrialTrials).to.equal(arenaTrial.trials.length - challengeTrials);
                done();
            });
            challenge.remove();
        });
    });

    describe("API", function() {
        var url = 'http://localhost:3000';
        var api = url + '/api';
        var user = {
            username: "amrd",
            email: "amr.m.draz@gmail.com",
            password: "drazdraz12",
            passwordConfirmation: "drazdraz12"
        };
        var student = {
                username: 'student',
                email: 'student@place.com',
                password: 'student123',
                role: 'student',
                activated: true
            },
            teacher = {
                username: 'teacher',
                email: 'teach@place.com',
                password: 'teacher123',
                role: 'teacher',
                activated: true
            },
            admin = {
                username: 'admin',
                email: 'admin@place.com',
                password: 'admin12345',
                role: 'admin',
                activated: true
            };
        var accessToken;
        var arena;
        var challenge = {
            challenge: {
                name: 'Basic Test',
                setup: "",
                solution: "var x = 20;",
                tests: "",
                preCode: "",
                postCode: "",
                description: "create a variable and assign to it the value 20",
                exp: 2,
                isPublished: false
            }
        };

        before(function(done) {
            Promise.fulfilled().then(function() {
                return [
                    Arena.create({}),
                    User.create(student),
                    User.create(teacher),
                    User.create(admin)
                ];
            }).spread(function(arena, st, t, a) {
                // console.log(st,t,a);
                student._id = st._id;
                student.token = st.token;
                admin._id = a._id;
                admin.token = a.token;
                teacher._id = t._id;
                accessToken = teacher.token = t.token;
                challenge.challenge.arena = arena.id;
                return setup.challengeTest(done);
            }).catch(done);
        });

        describe("POST", function() {

            it("should not work without accessToken", function(done) {
                request(api)
                    .post("/challenges")
                    .send(challenge)
                    .expect(401)
                    .end(done);
            });

            it("should not create a challenge if student", function(done) {
                request(api)
                    .post("/challenges")
                    .set('Authorization', 'Bearer ' + student.token)
                    .send(challenge)
                    .expect(401)
                    .end(done);

            });

            it("should create a challenge only if teacher", function(done) {
                request(api)
                    .post("/challenges")
                    .set('Authorization', 'Bearer ' + accessToken)
                    .send(challenge)
                    .end(function(err, res) {
                        if (err) return done(err);
                        res.status.should.equal(200);
                        res.body.challenge._id.should.exist;
                        res.body.challenge.name.should.equal(challenge.challenge.name);
                        res.body.challenge.exp.should.equal(challenge.challenge.exp);
                        res.body.challenge.arena.should.equal('' + challenge.challenge.arena);
                        challenge.id = res.body.challenge._id;
                        done();
                    });

            });

            it("should run code based on language returning stout and sterr", function(done) {
                request(api)
                    .post("/challenges/run")
                    .set('Authorization', 'Bearer ' + student.token)
                    .send({
                        code: code,
                        language: 'java'
                    })
                    .expect(200)
                    .end(function(err, res) {
                        if (err) return done(err);
                        res.status.should.equal(200);
                        res.body.stout.should.equal(out);
                        done();
                    });
            });
            it("should test code", function(done) {
                request(api)
                    .post("/challenges/test")
                    .set('Authorization', 'Bearer ' + student.token)
                    .send({
                        code:code,
                        challenge:testchallenge
                    })
                    .expect(200)
                    .end(function(err, res) {
                        if (err) return done(err);
                        res.status.should.equal(200);
                        res.body.report.passed.should.be.true;
                        done();
                    });
            });
        });

        describe("GET", function() {

            it("should return a challenge by id", function(done) {
                request(api)
                    .get("/challenges/" + challenge.id)
                    .end(function(err, res) {
                        if (err) return done(err);
                        res.status.should.equal(200);
                        expect(res.body.challenge).to.exist;
                        done();
                    });
            });

            it("should return a list of all challenges", function(done) {
                request(api)
                    .get("/challenges")
                    .end(function(err, res) {
                        if (err) return done(err);
                        res.status.should.equal(200);
                        res.body.challenge.length.should.equal(4); // 3 from setup + 1 from post
                        done();
                    });
            });

        });

        describe("PUT", function() {

            it("should not work without accessToken", function(done) {
                request(api)
                    .put("/challenges/" + challenge.id)
                    .send(challenge)
                    .expect(401)
                    .end(done);
            });

            it("should not create a challenge if student", function(done) {
                request(api)
                    .put("/challenges/" + challenge.id)
                    .set('Authorization', 'Bearer ' + student.token)
                    .send({
                        challenge: {
                            isPublished: true
                        }
                    })
                    .expect(401)
                    .end(done);

            });

            it("should update a challenge only if teacher", function(done) {
                request(api)
                    .put("/challenges/" + challenge.id)
                    .set('Authorization', 'Bearer ' + accessToken)
                    .send({
                        challenge: {
                            isPublished: true
                        }
                    })
                    .end(function(err, res) {
                        if (err) return done(err);
                        res.status.should.equal(200);
                        res.body.challenge.isPublished.should.equal(true);
                        challenge.isPublished = res.body.challenge.isPublished;
                        done();
                    });
            });
        });

        describe("DELETE", function() {

            it("should not work without accessToken", function(done) {
                request(api)
                    .del("/challenges/" + challenge.id)
                    .expect(401)
                    .end(done);
            });

            it("should not delete a challenge if student", function(done) {
                request(api)
                    .del("/challenges/" + challenge.id)
                    .set('Authorization', 'Bearer ' + student.token)
                    .send()
                    .expect(401)
                    .end(done);

            });

            it("should delete a challenge removing it from it's arena", function(done) {
                request(api)
                    .del("/challenges/" + challenge.id)
                    .set('Authorization', 'Bearer ' + accessToken)
                    .end(function(err, res) {
                        if (err) return done(err);
                        res.status.should.equal(200);
                        Challenge.findOne({
                            _id: challenge.id
                        }).exec().then(function(model) {
                            expect(model).to.not.exist;
                        }, done).then(function() {
                            Arena.findById(challenge.challenge.arena, function(err, arena) {
                                arena.challenges.length.should.equal(0);
                                done();
                            });
                        }, done);
                    });
            });
        });

    });
    //*/
});
