var async = require('async'),
	Interceptor = require('./interception');

function invokeCtor(ctor, interceptors, args) {
	var instance = Object.create(ctor.prototype);
	ctor.apply(instance, args);

	if (!interceptors.length) {
		return instance;
	}

	//create a proxy object that can intercept function calls.
	//eventually, it may do more than just functions, such as intercepting
	//accessors.
	Object.keys(instance).forEach(function(key) {
		var descriptor = Object.getOwnPropertyDescriptor(instance, key),
			thunk = instance[key];

		if (descriptor && !descriptor.configurable) {
			return;
		}

		//only intercept function calls (for now)
		if (typeof(thunk) !== 'function') {
			return;
		}

		var handlers = [];
		for (var i = 0; i < interceptors.length; i++) {
			if (interceptors[i].predicate(instance, key)) {
				[].push.apply(handlers, interceptors[i].handlers);
			}
		}

		if (!handlers.length) {
			//no interceptors match this function
			return;
		}

		var interceptor = new Interceptor(handlers);

		//redefine the property
		Object.defineProperty(instance, key, {
			writable: false,
			value: function() {
				//TODO handle async functions
				return interceptor.handleCallSync(instance, key, [].slice.call(arguments), thunk);
			}
		});
	});

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
	newInstanceSync: function(typeInfo, interceptors) {
		var args = getParams(typeInfo).map(function(typeData) {
			return this.resolverSync(typeData.type);
		}.bind(this));

		return invokeCtor(typeInfo.ctor, interceptors, args);
	},

	newInstance: function(typeInfo, interceptors, callback) {
		var self = this;
		async.map(getParams(typeInfo), function(typeData, next) {
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

			callback(null, invokeCtor(typeInfo.ctor, interceptors, args));
		});
	}
};

module.exports = ObjectBuilder;