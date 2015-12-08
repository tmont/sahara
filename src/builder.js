var async = require('async'),
	util = require('util'),
	EventEmitter = require('events').EventEmitter,
	Interceptor = require('./interception');

function getParams(typeInfo) {
	var params = typeInfo.args;
	params.sort(function(a, b) {
		if (a.position === b.position) {
			return 0;
		}

		return a.position < b.position ? -1 : 1;
	});

	return params;
}

function ObjectBuilder(resolver, resolverSync) {
	this.resolver = resolver;
	this.resolverSync = resolverSync;
}

util.inherits(ObjectBuilder, EventEmitter);

util._extend(ObjectBuilder.prototype, {
	invokeCtor: function(ctor, handlerConfigs, args) {
		var self = this,
			instance = new ctor(...args);

		if (!handlerConfigs.length) {
			return instance;
		}

		//create a proxy object that can intercept function calls.
		//eventually, it may do more than just functions, such as intercepting
		//getters.
		for (var key in instance) {
			var descriptor = Object.getOwnPropertyDescriptor(instance, key),
				thunk = instance[key];

			//not able to override this value, carry on
			if (descriptor && !descriptor.configurable) {
				continue;
			}

			//only intercept function calls (for now)
			if (typeof(thunk) !== 'function') {
				continue;
			}

			var isAsync = null;
			var matchingConfigs = handlerConfigs.filter(function(data) {
				var isMatch = data.matcher(instance, key);
				if (isMatch && isAsync === null) {
					isAsync = data.isAsync;
				}

				return isMatch && data.isAsync === isAsync;
			});

			if (!matchingConfigs.length) {
				//no handlers match this function
				continue;
			}

			var handlers = [];
			matchingConfigs.forEach(function(data) {
				[].push.apply(handlers, data.handlers);
			});

			//redefine the property
			Object.defineProperty(instance, key, {
				writable: false,
				value: (function(isAsync, methodName, thunk) {
					var interceptor = new Interceptor(handlers);
					return function() {
						self.emit('intercepting', instance, methodName);
						var handleCall = 'handleCall' + (isAsync ? '' : 'Sync');
						return interceptor[handleCall](
							instance,
							methodName,
							[].slice.call(arguments),
							thunk
						);
					};
				}(isAsync, key, thunk))
			});
		}

		return instance;
	},

	newInstanceSync: function(typeInfo, handlerConfigs, context) {
		this.emit('building', typeInfo);
		var args = getParams(typeInfo).map(function(typeData) {
			return this.resolverSync(typeData.type, context);
		}.bind(this));

		var instance = this.invokeCtor(typeInfo.ctor, handlerConfigs, args);
		this.emit('built', typeInfo, instance);
		return instance;
	},

	newInstance: function(typeInfo, handlerConfigs, context, callback) {
		this.emit('building', typeInfo);
		var self = this;
		async.mapSeries(getParams(typeInfo), function(typeData, next) {
			self.resolver(typeData.type, context, next);
		}, function(err, args) {
			if (err) {
				callback(err);
				return;
			}

			var instance = self.invokeCtor(typeInfo.ctor, handlerConfigs, args);
			self.emit('built', typeInfo, instance);
			callback(null, instance);
		});
	}
});

module.exports = ObjectBuilder;
