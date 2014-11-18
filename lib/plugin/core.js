/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
// # Core Plugin
// Sets various template renderings based on options or options.pkg
// being set to `require("./package.json")`.
(function () {
  'use strict';
  var _ = require('lodash');
  var util = require('util');
  var Plugin = require('code-annotate-plugin-base');
  var debug = require('debug')('code-annotate:plugin-core');
  var async = require('async');

  function PluginCore(annotate) {
    debug("Instantiating");
    Plugin.apply(this, arguments);
    debug("Instantiated");
  }
  PluginCore.name = 'core';
  util.inherits(PluginCore, Plugin);

  PluginCore.prototype.init = function (opt) {
    var that = this;
    debug("Initiating");
    Plugin.prototype.init.apply(this, arguments);

    var pkg, keywords, maybeEmit;

    pkg = opt.pkg || this.anno.opt.pkg;
    if (!pkg) pkg = {};

    maybeEmit = function (name, data) {
      if (data) this.emit(name, data);
    }.bind(this);


    debug('title: ' + (that.opt.title || pkg.name));
    maybeEmit('title', that.opt.title || pkg.name);
    debug('packageTitle: ' + (that.opt.packageTitle || pkg.name));
    maybeEmit('packageTitle', that.opt.packageTitle || pkg.name);
    debug('packageDescription: ' + (that.opt.packageDescription || pkg.description));
    maybeEmit('packageDescription', that.opt.packageDescription || pkg.description);
    keywords = that.opt.keywords || pkg.keywords;
    if (keywords && !_.isArray(keywords))
      keywords = [keywords];
    debug("keywords ", keywords);
    if (keywords && keywords.length)
      that.emit('meta', {name: "keywords", content: keywords.join(",")});
  };

  module.exports = PluginCore;
})();
