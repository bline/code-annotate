/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
// # plugin/render.js
(function () {
  'use strict';
  var jade = require('jade'),
    debugNS = 'code-annotate:plugin:render',
    path = require('path'),
    debug = require('debug')(debugNS),
    fs = require('fs'),
    outcome = require('outcome');

  module.exports = require('code-annotate-plugin').extend({
    name: 'renderer',
    Plugin: Renderer,
    isRenderer: true
  });

  function Renderer() {
    Renderer.super_.apply(this, arguments);
  }

  Renderer.defaultOptions = {
    baseTemplatePath: path.join(__dirname, "..", "..", "resources", "base.jade")
    outputFile: 'index.html',
    jadeOpt: {
      pretty: true,
      debug: debug.enabled(debugNS + ':jade'),
      compileDebug: debug.enabled(debugNS + ':jadeCompile')
    },
    baseLocals: {}
  };
  Renderer.prototype.load = function (callback) {
    var baseTemplate = this.loader.params('render.baseTemplatePath'),
      jadeOpt = _.extend({filename: baseTemplate}, this.loader.params('render.jadeOpt') || {}),
      on = outcome.error(callback),
      that = this;

    fs.readFile(baseTemplate, { encoding: 'utf8' }, on.success(function (data) {
      try {
        that.templateFunc = jade.compile(data, jadeOpt);
      } catch (e) {
        return this(new Error("failed to compile " + baseTemplate + "; " + e));
      }
      this(null, that);
    }));
  };
  Renderer.prototype.render = function (annotation, callback) {
    var baseTemplate = this.loader.params('render.baseTemplatePath'),
      outputFile = this.loader.params('render.outputFile'),
      rendering = {};
    this.currentLocals = _.extend({
      plugin: this.loader.exports,
      render: this.renderPart.bind(this),
      renderOne: this.renderOnePart.bind(this),
      annotation: annotation
    }, this.loader.params('render.baseLocals') || {});
    try {
      rendering[outputFile] = this.templateFunc(this.currentLocals);
    } catch (e) {
      return callback(new Error("failed to run " + baseTemplate + "; " + e));
    }
    callback(null, rendering);
  };
  Renderer.prototype.renderPart = function (part, joinOn) {
    return this._renderPart(part, joinOn);
  };
  Renderer.prototype.renderOnePart = function (part) {
    return this._renderPart(part, null, true);
  };
  Renderer.prototype._renderPart = function (part, joinOn, one) {
    var plugins, that = this,
      test = {},
      caseStr = part[0].toUpperCase() + part.slice(1),
      render = 'render' + caseStr;
    test['has' + caseStr] = true;
    this.loader.loadModules(test, function (plugins) {
      plugins = plugins;
    });
    if (!plugins)
      throw new Error("plugins not loaded");
    if (one)
      plugins = [plugins.pop()];
    return plugins
      .map(function (plugin) { return formatPart(part, plugin[render](that.currentLocals)); })
      .map(_.flatten)
      .join(joinOn || "\n");
  };

  var formatPartHints = {
    meta:              { $tag: 'meta', $data: "$attrs" }],
    stylesheet:        { $tag: 'link', rel: "stylesheet", $data: "href" },
    script:            { $tag: 'script', type: 'text/javascript', $data: 'src' },
    title:             { $tag: 'title' },
    initScript:        { $tag: 'script', $data: '$content' }
  };
  /* return array */
  function formatPart(type, data) {
    data = _.isArray(data) ? data : [data];
    var hint = formatPartHints[type];
    return data.map(function (ele) {
      if (!hint) return ele;
      hint = _.clone(hint);
      var tag = hint.$tag, attrs, content = '', html = '',
        target = !_.isString(ele) ? '$attrs' : hint.$data || '$content';
      delete hint.$tag;
      delete hint.$data;
      attrs = hint;
      if (target === '$attrs')
        _.extend(attrs, ele);
      else if (target === '$content')
        content = ele;
      else
        attrs[target] = ele;

      html = '<' + tag;
      if (_.keys(attrs).length)
        html += ' ' + _.map(attrs, function (v, k) { return k + '="' + _.escape(v) + '"'; }).join(' ');
      if (content)
        html += '>' + content + '</' + tag + '>';
      else if (tag === 'script')
        html += '></script>';
      else
        html += '/>';
      return html;
    });
  }

})();
