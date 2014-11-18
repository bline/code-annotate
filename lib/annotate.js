// [marked]: https://github.com/chjj/marked
// [code-part]: http://github.com/bline/code-part
// [Github Version]: https://badge.fury.io/
// [Travis]: https://travis-ci.org/
// [code-prettify]: https://code.google.com/p/google-code-prettify/
// [SyntaxHighlighter]: http://alexgorbatchev.com/SyntaxHighlighter/
// [highlight.js]: https://highlightjs.org/
/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
// # annotate.js
(function () {
  'use strict';
  // ## Usage
  //
  // With files:
  //
  // ```javascript
  //  var Annotate = require('code-annotate');
  //  var _ = require('lodash');
  //
  //  var options = {
  //    plugins: [
  //      'code-prettify',
  //      'markdown',
  //      'bootstrap'
  //    ],
  //    pkg: require('./package.json'),
  //    codePrettify: { ... },
  //    markdown: { ... },
  //    bootstrap: { ... }
  //  };
  //
  // ```
  //
  var _ = require('lodash'),
    outcome = require('outcome'),
    util = require('util'),
    path = require('path'),
    async = require('async'),
    fs = require('fs'),
    EventEmitter = require('events').EventEmitter,
    debug = require('debug')('code-annotate');

  function Annotate(opt) {
    EventEmitter.call(this);
    debug("Instantiating");
    if (!opt) opt = {};
    this.opt = _.extend({}, Annotate.defaults, opt);
    this.util = require('./util')(this);
    debug("Instantiated");
    return this;
  }

  Annotate.defaults = {
    basePath: path.dirname(module.parent ? module.parent.filename : path.join(__dirname, '..', '..', '..')),
    resourcePath: path.join(__dirname, '..', 'resources'),
    plugins: null,
    pluginPaths: null,
    extension: null
  };
  Annotate.defaultPlugins = [];
  Annotate.defaultPluginPaths = [];
  Annotate.corePlugins = ['part', 'render'];
  Annotate.corePluginPath = path.join(__dirname, 'plugin');

  util.inherits(Annotate, EventEmitter);

  function formatPlugins(plugins) {
    return plugins.map(function (plugin) {
      if (plugin[0] === '=')
        return plugin.slice(1);
      return 'code-annotate-plugin-' + plugin;
    });
  }

  Annotate.prototype.init = function () {
    try {
      this._initLoader();
    } catch (e) {
      this.emit('error', e);
    }
  };

  Annotate.prototype._initLoader = function () {
    debug("Initializing plugin loader");
    var plugins = formatPlugins(this.opt.plugins || Annotate.defaultPlugins).concat(Annotate.corePlugins),
      pluginPaths = (this.opt.pluginPaths || Annotate.defaultPluginPaths).concat([Annotate.corePluginPath]);

    this._loader = require('plugin')(this);

    /* Allow for custom plugins */
    this._loader.paths.apply(this._loader, pluginPaths);
    this._loader.load().once('ready', function (plugins) {
      debug("Plugins loaded");
      this._pluginsLoaded = true;
      _.values(plugins).forEach(function (plugin) {
        var opt = this._loader.params(plugin.name);
        _.merge(opt, plugin.defaultOptions || plugin.defaults || {});
        this._loader.params(plugin.name, opt);
      }.bind(this));
      this._loader.params(this.opt);
    }.bind(this));
    return this;
  };

  Annotate.prototype.parse = function (files, callback) {
    var on = outcome.error(callback),
      that = this;

    this._ensurePluginsLoaded(on.success(function () {
      async.waterfall([
        this._parseFiles    .bind(this, files),
        this._formatSections.bind(this),
        this._formatFiles   .bind(this)
      ], on.success(function (annotation) {
        callback(null, annotation);
      }));
    }.bind(this)));
    return this;
  };

  Annotate.prototype._ensurePluginsLoaded = function (callback) {
    if (this._pluginsLoaded) return callback(null, this._loader.exports);
    this._loader.once('ready', callback);
  };

  Annotate.prototype._parseFiles = function (files, callback) {
    var on = outcome.error(callback),
      annotation = {
        files: [],
        sections: {}
      };
    this._loader.loadModule({ isParser: true }, on.success(function (parser) {
      async.each(files, function (file, next) {
        that.util.loadSrc(file, on.success(function (file) {
          parser.parse(file, on.success(function (sections) {
            file.sections = sections;
            annotation.files.push(file);
            next();
          }));
        }));
      }, on.success(function () {
        callback(null, annotation);
      }));
    }));
    return this;
  };

  Annotate.prototype._formatSections = function (annotation, callback) {
    var on = outcome.error(callback);
    this._loader.loadModules({ isSectionFormatter: true }, on.success(function (sectionFormatters) {
      async.each(annotation.files, function (file, next) {
        async.each(file.sections, function (section, next) {
          async.each(sectionFormatters, function (formatter, next) {
            formatter.formatSection(section, on.success(function (format) {
              section[formatter.name] = format;
              next();
            }));
          }, next);
        }, next);
      }, on.success(function () {
        callback(null, annotation);
      }));
    }));
    return this;
  };

  Annotate.prototype._formatFiles = function (annotation, callback) {
    var on = outcome.error(callback);
    this._loader.loadModules({ isFileFormatter: true }, on.success(function (fileFormatters) {
      async.eachSeries(fileFormatters, function (formatter, next) {
        formatter.formatFile(annotation, next);
      }, on.success(function () {
        callback(null, annotation);
      }));
    }));
  };

  Annotate.prototype.render = function (annotation, callback) {
    var on = outcome.error(callback),
      outputFiles = {},
      renderers = this._loader.loadModulesSync({ isRenderer: true });

    if (!annotition) throw new Error("no annotation passed to Annotate.render()");

    async.each(renderers, function (renderer, next) {
      renderer.render(annotation, on.success(function (files) {
        _.extend(outputFiles, files);
        next();
      }));
    }, on.success(function () {
      callback(null, outputFiles);
    }));

    return this;
  };

  Annotate.renderFiles = function (files, opts, callback) {
    if (_.isFunction(opts)) {
      callback = opts;
      opts = null;
    }
    var on = outcome.error(callback),
      annotate = new Annotate(opts);
    annotate.init();

    return annotate.parse(files, on.success(function (annotation) {
      annotate.render(annotation, callback);
    }));
  };

  Annotate.parseFiles = function (files, opts, callback) {
    if (_.isFunction(opts)) {
      callback = opts;
      opts = null;
    }
    var annotate = new Annotate(opts);
    annotate.init();
    return annotate.parse(files, callback);
  };

  module.exports = Annotate;
})();

