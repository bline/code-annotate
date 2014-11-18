/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
formatter = new Formatter();
parser = new Parser(formatter);
files.foreach(function (file) {
  parser.parse(file);
});
renderer = new Renderer();
renderer.render(formatter, function (err, html) {
});

// # Plugins loader/renderer.
(function () {
  'use strict';
  var _ = require('lodash');
  var AsyncEventEmitter = require('async-eventemitter');
  var async = require('async');
  var util = require('util');
  var debuger = require('debug');
  var getDebug = function (suffix) {
    return debuger('code-annotate:plugins:' + suffix);
  };
  var debug = debuger('code-annotate:plugins');

  function Plugins(anno, plugins) {
    AsyncEventEmitter.call(this);
    this.plugins = plugins.slice(0);
    this.anno = anno;
    return this;
  }
  util.inherits(Plugins, AsyncEventEmitter);

  Plugins.prototype._pluginInstEmit = function (type, data, callback) {
    var debug = getDebug('_pluginInstEmit');
    if (typeof callback !== 'function') {
      debug("invalid arguments");
      throw new Error("_pluginInstEmit requires a callback");
    }
    debug(type);
    var that = this;
    var k = 'plugin' + type[0].toUpperCase() + type.slice(1);
    this[k] = data;
    async.series([
      function (next) {
        debug("emit plugin-" + type);
        that.emit('plugin-' + type, that[k], next);
      },
      function (next) {
        debug("emit plugin-" + [type, that[k].constructor.name].join('-'));
        that.emit('plugin-' + [type, that[k].constructor.name].join('-'), that[k], next); 
      }
    ], function (err) {
      debug(type + " done");
      var cp = that[k];
      delete that[k];
      callback(err, cp);
    });
    return this;
  };
  Plugins.prototype._pluginClassEmit = function (type, data, callback) {
    var debug = getDebug('_pluginClassEmit');
    debug(type);
    var that = this;
    var k = 'plugin' + type[0].toUpperCase() + type.slice(1);
    this[k] = data;
    var name = this[k].name || this[k];
    async.series([
      function (next) {
        debug("emit plugin-" + type);
        that.emit('plugin-' + type, that[k], next);
      },
      function (next) {
        debug("emit plugin-" + [type, name].join('-'));
        that.emit('plugin-' + [type, name].join('-'), that[k], next);
      }
    ], function (err) {
      debug(type + " done");
      var cp = that[k];
      delete that[k];
      callback(err, cp);
    });
    return this;
  };

  Plugins.prototype.loadPlugin = function (pluginName, callback) {
    var debug = getDebug('loadplugin');
    var that = this;
    debug((pluginName.name || pluginName));
    var PluginClass = pluginName, config, plugin;
    if (_.isString(pluginName)) {
      async.waterfall([
        function (next) {
          debug("emit load");
          that._pluginClassEmit('load', pluginName, next);
        },
        function (pluginName, next) { 
          debug("loading " + pluginName);
          var PluginClass;
          try {
            PluginClass = require('code-annotate-plugin-' + pluginName);
          } catch (e) {
            debug("failed to load " + pluginName + "; " + e);
            return next(e);
          }
          debug("loaded " + pluginName);
          next(null, PluginClass);
        },
        function (PluginClass, next) {
          debug("emit loaded");
          that._pluginClassEmit('loaded', PluginClass, next);
        }
      ], function (err, PluginClass) {
        debug(PluginClass.name + " done");
        callback.call(that, err, PluginClass);
      });
    } else {
      debug(PluginClass.name + " loaded");
      callback.call(that, null, PluginClass);
    }

    return this;
  };
  Plugins.prototype.instantiatePlugin = function (PluginClass, callback) {
    var debug = getDebug("instantiatePlugin");
    var that = this;
    debug(PluginClass.name);
    async.waterfall([
      function (next) {
        debug("_pluginClassEmit instantiate");
        that._pluginClassEmit('instantiate', PluginClass, next); 
      },
      function (PluginClass, next) {
        debug("new " + PluginClass.name);
        next(null, new PluginClass(that.anno));
      },
      function (plugin, next) {
        debug("_pluginInstEmit instantiated");
        that._pluginInstEmit('instantiated', plugin, next);
      }
    ], function (err, plugin) {
      if (err)
        debug("error: " + err);
      else
        debug(plugin.constructor.name + " done");
      callback(err, plugin);
    });
    return this;
  };
  Plugins.prototype.initiatePlugin = function (plugin, callback) {
    var debug = getDebug("initiatePlugin");
    var that = this;
    debug(plugin.constructor.name);
    var pluginName, pluginOpt;

    var initPlugin = function (plugin, next) {
        pluginOpt = _.cloneDeep(that.anno.opt[plugin.constructor.name] || {});
        if (!pluginOpt) pluginOpt = that.anno.opt[plugin.constructor.name] = {};
        if (plugin.constructor.defaults)
          _.defaults(pluginOpt, plugin.constructor.defaults);
        _.defaults(pluginOpt, that.anno.pluginDefaults);

        if (plugin.init.length === 1) {
          plugin.init(pluginOpt);
          next(null, plugin);
        } else {
          plugin.init(pluginOpt, next);
        }
    };

    async.waterfall([
      function (next)         {
        debug("_pluginInstEmit initiate");
        that._pluginInstEmit('initiate', plugin, next);
      },
      initPlugin,
      function (plg, next) {
        if (arguments.length === 1) {
          next = plg;
          plg = plugin;
        }
        debug("_pluginInstEmit initiated");
        that._pluginInstEmit('initiated', plg, next);
      }
    ], function (err, plugin) {
      if (err)
        debug("failed: " + err);
      else {
        debug(plugin.constructor.name + " done");
      }
      callback(err, plugin);
    });

    return this;
  };
  Plugins.prototype.load = function (callback) {
    var debug = getDebug('load');
    var that = this;
    async.waterfall([
      function (next) {
        debug("preload");
        that.pluginsLoading = that.plugins;
        that.plugins = [];
        that.emit('plugins-load', that.pluginsLoading, function (err) {
          next(err, that.pluginsLoading);
          delete that.pluginsLoading;
        });
      },
      function (plugins, next) {
        debug("loadPlugin " + plugins.length);
        async.mapSeries(plugins, that.loadPlugin.bind(that), next);
      },
      function (plugins, next) {
        debug("emit plugins-loaded");
        that.pluginsLoaded = plugins;
        that.emit('plugins-loaded', that.pluginsLoaded, function (err) {
          next(err, that.pluginsLoaded); 
          delete that.pluginsLoaded;
        });
      },
      function (plugins, next) {
        debug("emit plugins-instantiate");
        that.pluginsInstantiating = plugins;
        that.emit('plugins-instantiate', that.pluginInstantiating, function (err) {
          next(err, that.pluginsInstantiating);
          delete that.pluginsInstantiating;
        });
      },
      function (plugins, next) {
        debug("instantiatePlugin " + plugins.length);
        async.mapSeries(plugins, that.instantiatePlugin.bind(that), next);
      },
      function (plugins, next) {
        debug("emit plugins-initiated");
        that.pluginsInitiating = plugins;
        that.emit('plugins-initiated', that.pluginsInstantiated, function (err) {
          next(err, that.pluginsInitiating);
          delete that.pluginsInitiating;
        });
      },
      function (plugins, next)  {
        debug("initiatePlugin " + plugins.length);
        async.mapSeries(plugins, that.initiatePlugin.bind(that), function (err, plugins) {
          if (plugins)
            debug("initiatePlugin done " + plugins.length);
          else
            debug("err: " + err);
          next(err, plugins);
        });
      }
    ], function (err, plugins) {
      if (plugins)
        debug("finished " + plugins.length);
      else
        debug("error " + err);

      that.plugins = plugins;
      callback.call(that, err, that.plugins);
    });
    return this;
  };
  Plugins.prototype.renderOne = function (type) {
    var debug = getDebug('renderOne'), ret = '';
    debug(type + " start");
    var plugin = _
      .find(this.plugins.slice(0).reverse(), function (plugin) {
        var ret = plugin.canRender(type);
        return ret; });
    if (plugin) {
      ret = plugin.render(type);
    }
    debug(type + " end");
    return ret;
  };
  Plugins.prototype.render = function (type, joinOn) {
    var debug = getDebug('render');
    debug(type + " start");
    var ret = _(this.plugins)
      .filter(function (plugin) {
        return plugin.canRender(type);})
      .map(function (plugin) {
        return plugin.render(type); })
      .value()
      .join(joinOn || '\n');
    debug(type + " end");
    return ret;
  };
  module.exports = Plugins;
})();
