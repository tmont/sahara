const ObjectBuilder = require('../object-builder');
const Interceptor = require('./interception');

class InterceptableObjectBuilder extends ObjectBuilder {

	invokeCtor(ctor, handlerConfigs, args) {
		const instance = super.invokeCtor(ctor, handlerConfigs, args);

		if (!handlerConfigs.length) {
			return instance;
		}

		//create a proxy object that can intercept function calls.
		//eventually, it may do more than just functions, such as intercepting
		//getters.
		for (const key in instance) {
			const methodName = key;
			const descriptor = Object.getOwnPropertyDescriptor(instance, methodName);
			const thunk = instance[methodName];

			//not able to override this value, carry on
			if (descriptor && !descriptor.configurable) {
				continue;
			}

			//only intercept function calls (for now)
			if (typeof(thunk) !== 'function') {
				continue;
			}

			let isAsync = null;
			const matchingConfigs = handlerConfigs.filter((data) => {
				const isMatch = data.matcher(instance, methodName);
				if (isMatch && isAsync === null) {
					isAsync = data.isAsync;
				}

				return isMatch && data.isAsync === isAsync;
			});

			if (!matchingConfigs.length) {
				//no handlers match this function
				continue;
			}

			const handlers = [];
			matchingConfigs.forEach((data) => {
				[].push.apply(handlers, data.handlers);
			});

			//redefine the property
			Object.defineProperty(instance, methodName, {
				writable: false,
				value: ((isAsync, thunk, methodName) => {
					const interceptor = new Interceptor(handlers);
					return (...args) => {
						this.emit('intercepting', instance, methodName);
						const handleCall = 'handleCall' + (isAsync ? '' : 'Sync');
						return interceptor[handleCall](
							instance,
							methodName,
							args,
							thunk
						);
					}
				})(isAsync, thunk, methodName)
			});
		}

		return instance;
	}
}

module.exports = InterceptableObjectBuilder;
