/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
// # plugin/part.js
(function () {
  'use strict';
  var part = require('code-part'),
    dox = require('dox');

  module.exports = require('code-annotate-plugin').extend({
    name: 'part',
    isParser: true,
    Plugin: Part
  });

  function Part() {
    Part.super_.apply(this, arguments);
  }
  Part.prototype.parse = function (file, callback) {
    var partOpt = this.loader.params('part') || {},
      sections;
    part(file.name, file.contents, partOpt, callback);
  };
})();
