module.exports = Em.Mixin.create(Em.Evented, {
    evaluates: 'code',
    jshint: function(code, cb, options) {
        options = options || {};
        var console = this.get('console') || console;
        console.Write = console.Write || console.log;
        var sb = options.sandbox || this.get('csandbox') || window;
        JSHINT(code, {
            "asi": true, // supress simicolon warning
            "boss": true, // supress warning about using assignment inside while condition
            "eqnull": true,
            "expr": true, // you can type random expressions
            "esnext": false,
            "bitwise": true,
            "curly": false,
            "eqeqeq": true,
            "eqnull": true,
            "immed": false,
            "latedef": false,
            "newcap": false,
            "noarg": true,
            "undef": false,
            "strict": false,
            "trailing": false,
            "smarttabs": true,
        });
        var errors = JSHINT.errors;
        if (!errors.length) {
            cb && cb.call(this, code, console, sb);
        } else {
            this.testError({
                lineNumber: errors[0].line,
                message: errors[0].reason,
                rest: errors
            });
        }

        // debugger;
        return errors;
    },
    testError: function(error) {
        var console = this.get('console') || console;
        console.Write = console.Write || console.log;
        console.Write('Syntax Error line(' + error.lineNumber + '): ' + error.message + '\n', 'error');
        return false;
    },
    testSuccess: function(report) {
        var tests = report.tests.length;
        var passes = report.passes.length;
        var failures = report.failures.length;
        var pass = report.passed;
        var jconsole = this.get('console') || console;
        jconsole.Write = jconsole.Write || console.log;
        var writeTest = function(test, pass) {
            jconsole.Write((test.fullName||test.message) + '\n', pass);
        };
        console.log(report);
        jconsole.Write("========= Running Submission " + (pass ? 'Passed' : 'Failed') + " ==========\n", pass ? 'result' : 'error');

        if (passes) {
            report.passes.forEach(function(test) {
                writeTest(test, 'result');
            });
            failures && jconsole.Write('\n-----------------------------------\n\n');
        }

        if (failures) {
            report.failures.forEach(function(test) {
                writeTest(test, 'error');
                test.failedExpectations && test.failedExpectations.forEach(function(fail) {
                    if (fail.message.indexOf('Error: Timeout')) {
                        jconsole.Write('\t' + fail.message + '\n', 'error');
                    } else {
                        jconsole.Write('\tTimeout this test ran (' + test.durationSec + 's)\n', 'error');
                    }
                });
                // console.error(test.failedExpectations[0].stack);
            });
        }
        if (passes||failures) jconsole.Write("==============================================\n", pass ? 'result' : 'error');

        return report.passed;
    },
    parseSterr : function (sterr) {
        var i,column_no_start,column_no_stop,errs,fragment,lines = sterr.split('\n'),found = [];

        for (i = 0;i<lines.length;) {
            if(~lines[i].indexOf('Error')) {
                errs = lines[i++].match(/Error.* line (\d*).* error: (.*)/);
                fragment = lines[i++]+"\n";
                column_no_start = lines[i++].length-2;
                column_no_stop = column_no_start+1;
            } else {
                errs = lines[i++].match(/Exception.* line (\d*) (.*)/);
                column_no_start = 0;
                column_no_stop = 200;
                fragment = '';
            }
            found.push({
                line_no:(+errs[1])-2,
                column_no_start: column_no_start,
                column_no_stop: column_no_stop,
                message:errs[2],
                fragment:fragment,
                severity: "error"
            });
        }
        console.log(found);
        return found;
    },
    runInServer: function(code, language, cb) {
        Em.$.ajax({
            url: '/api/challenges/run',
            type:'POST',
            data: {
                code: code,
                language: language
            }
        }).done(cb).fail(function (err) {
            toastr.error(err.statusText);
        });
    },
    testInServer: function(code, challenge, cb) {
        Em.$.ajax({
            url: '/api/challenges/test',
            type:'POST',
            data: {
                code: code,
                challenge: challenge.getProperties(['preCode','language','tests','postCode', 'exp'])
            }
        }).done(cb).fail(function (err) {
            toastr.error(err.responseText);
        });
    },
    actions: {
        sandboxLoaded: function(sb) {
            var that = this;
            var log = function(msg) {
                console.log(msg);
                that.get('console').Write(msg.toString() + '\n');
            };

            sb.on('error', this.testError.bind(this));
            sb.on('test.done', this.testSuccess.bind(this));
            // sb.on('structure.done', log);
            sb.on('log', log);
            console.log('loaded sandbox');
        },
        runInConsole: function() {
            this.trigger('showConsole');
            this.send('consoleEval', this.get('model.' + this.get('evaluates')));
        },
        consoleEval: function(command) {
            this.jshint(command, function(code, console, sb) {
                console.Focus();
                sb.evaljs(code, function(error, res) {
                    if (error) {
                        console.Write(error.name + ': ' + error.message + '\n', 'error');
                    } else {
                        var run = res !== undefined;
                        console.Write((run ? '==> ' + res : '\n' + code) + '\n', run ? 'result' : 'jqconsole-old-prompt');
                    }
                });
            });
        }
    }
});
