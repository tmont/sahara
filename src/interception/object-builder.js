var ObjectBuilder = require('../object-builder'),
	merge = require('../merge'),
	Interceptor = require('./interception');

function InterceptableObjectBuilder(resolver, resolverSync) {
	ObjectBuilder.call(this, resolver, resolverSync);
}

merge(InterceptableObjectBuilder.prototype, ObjectBuilder.prototype, {
	invokeCtor: function(ctor, handlerConfigs, args) {
		var self = this,
			instance = ObjectBuilder.prototype.invokeCtor.apply(this, arguments);

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
});

module.exports = InterceptableObjectBuilder;
