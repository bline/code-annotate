/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
// # gulpfile.js for code-annotate
//
(function () {
  'use strict';
  var path = require('path');
  var gulp = require('gulp');
  var _ = require('lodash');
  var $ = require('gulp-load-plugins')();
  var opn = require('opn');
  var del = require('del');
  var pkg = require('./package.json');

  // ## Configuration Variables
  //
  // * lintSrc -
  //   Sources for jslint for `lint` target.
  var lintSrc  = ['./lib/**/*.js', './gulpfile.js', 'test/**/*.js'];
  // * annoSrc -
  //   Sources to generate annotated code from for `annotate` target.
  var annoSrc  = lintSrc.concat(['README.md', './resources/*.*', 'LICENSE']);
  // * testSrc
  //   Test helpers followed by tests for `test` target, the default target.
  var testSrc  = ['test/*helper.js', 'test/*spec.js'];
  // * annoOpt
  //   Options passed to code-annotate for `annotate` target.
  var annoOpt  = {
    pkg: pkg,
    plugins: [
      'code-prettify',
      'bootstrap'
    ],
    codePrettify: { style: 'sunburst' }
  };

  // ## Helper functions
  //
  // * runCoverage -
  //   Used in `coveralls` and `coverage` task. Run coverage with
  //   Instruments with [gulp-coverage](https://github.com/dylanb/gulp-coverage)
  //   and runs tests with [gulp-mocha](https://github.com/sindresorhus/gulp-mocha).

  function runCoverage (opts) {
    return gulp.src(testSrc, { read: false })
      .pipe($.coverage.instrument({
        pattern: ['./index.js'],
        debugDirectory: 'debug'}))
      .pipe($.plumber())
      .pipe($.mocha({reporter: 'dot'})
            .on('error', function () { this.emit('end'); })) // test errors dropped
      .pipe($.plumber.stop())
      .pipe($.coverage.gather())
      .pipe($.coverage.format(opts));
  }

  // ## Tasks
  //
  // ### clean
  //
  // Removes coverage and annotation build files.

  gulp.task("clean", function (done) {
    del(["coverage.html", "debug/**/*", "debug", "dist/*", "dist"], done);
  });

  // ### lint
  //
  // Runs `lintSrc` through [gulp-jshint](https://github.com/spenceralger/gulp-jshint),
  gulp.task("lint", function () {
    return gulp.src(lintSrc)
      .pipe($.jshint())
      .pipe($.jshint.reporter(require('jshint-table-reporter')));
  });

  // ### coveralls
  //
  // Runs coverage and pipes it to [gulp-coveralls](https://github.com/markdalgleish/gulp-coveralls).
  //
  // Deps: clean

  gulp.task('coveralls', ['clean'], function () {
    return runCoverage({reporter: 'lcov'})
      .pipe($.coveralls());
  });

  // ### coverage
  //
  // Generates coverage report in `coverage.html` using [gulp-coverage](https://github.com/dylanb/gulp-coverage)
  // and open the file in the default viewer with [opn](https://github.com/sindresorhus/opn).

  gulp.task('coverage', ['clean'], function () {
    return runCoverage({outFile: './coverage.html'})
      .pipe(gulp.dest('./'))
      .on('end', function () {
        opn('./coverage.html');
      });
  });

  // ### annotate
  //
  // Annotates all files in `annoSrc` into dist/index.html
  // using [code-annotate](https://github.com/bline/code-annotate).

  gulp.task("annotate", function (done) {
    var Annotate = require('./index.js');
    var through2 = require('through2');
    var File = $.util.File;
    var Buffer = require('buffer').Buffer;
    var files = [];
    gulp.src(annoSrc, { read: false })
      .pipe(through2.obj(function (file, encoding, done) {
        files.push(file.path);
        done();
      }, function (done) {
        var that = this;
        $.util.log("calling renderFiles");
        Annotate.renderFiles(files, annoOpt, function (err, renderFiles) {
          $.util.log("Render done ");
          if (err)
            return that.emit('error', new $.util.PluginError('annotate', err));
          _.forEach(renderFiles, function (contents, relpath) {
            var buffer = _.isString(contents) ? new Buffer(contents) : contents;
            $.util.log("render " + relpath);
            var file = new File({
              base: __dirname,
              cwd: __dirname,
              path: path.join(__dirname, relpath),
              contents: buffer
            });
            that.push(file);
          });
          that.emit('end');
        });}))
      .pipe(gulp.dest('dist')
        .on('end', function () {
          done();
          //opn('./dist/index.html');
        }));
  });

  // ### test
  //
  // The default task. Runs tests in `testSrc` with [gulp-mocha].

  gulp.task("test", ['clean', 'lint'], function () {
    return gulp.src(testSrc, { read: false })
      .pipe($.plumber())
      .pipe($.mocha({reporter: 'spec', globals: ['expect', 'should']})
           .on('error', function () { this.emit('end'); }))
      .pipe($.plumber.stop());
  });

  gulp.task('server', function (next) {
    var connect = require('connect'),
      serveStatic = require('serve-static'),
      server = connect();
    server.use(serveStatic('dist')).listen(process.env.PORT || 8080, next);
    $.util.log("serving on localhost:" + (process.env.PORT || 8080));
  });

  // ### watch
  //
  // Watches lintSrc and reruns test/annotate tasks with any files have
  // changed.

  gulp.task("watch", ['server'], function () {
    $.livereload.listen();
    gulp
      .watch(lintSrc.concat(['./node_modules/code-annotate-plugin-bootstrap/resources/*.*']))
      .on('change', function () {
        gulp.start(['annotate'], $.livereload.changed);
      });
  });

  // ### default
  // test
  gulp.task("default", ["test"]);
})();
// ## COPYRIGHT
//
// Copyright (C) 2014 Scott Beck, all rights reserved
//
// Licensed under the MIT license
//
