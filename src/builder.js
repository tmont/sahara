var async = require('async'),
	Interceptor = require('./interception');

function invokeCtor(ctor, handlerConfigs, args) {
	var instance = Object.create(ctor.prototype);
	ctor.apply(instance, args);

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

		var isAsync;
		var matchingConfigs = handlerConfigs.filter(function(data) {
			var isMatch = data.matcher(instance, key);
			if (isMatch && isAsync === undefined) {
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
}

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

ObjectBuilder.prototype = {
	newInstanceSync: function(typeInfo, handlerConfigs) {
		var args = getParams(typeInfo).map(function(typeData) {
			return this.resolverSync(typeData.type);
		}.bind(this));

		return invokeCtor(typeInfo.ctor, handlerConfigs, args);
	},

	newInstance: function(typeInfo, handlerConfigs, callback) {
		var self = this;
		async.mapSeries(getParams(typeInfo), function(typeData, next) {
			self.resolver(typeData.type, function(err, param) {
				process.nextTick(function() {
					next(err, param);
				});
			});
		}, function(err, args) {
			if (err) {
				callback(err);
				return;
			}

			callback(null, invokeCtor(typeInfo.ctor, handlerConfigs, args));
		});
	}
};

module.exports = ObjectBuilder;