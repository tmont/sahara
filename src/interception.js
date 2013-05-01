function Interceptor(handlers) {
	this.handlers = handlers;
}

Interceptor.prototype = {
	handleCallSync: function(instance, methodName, args, thunk) {
		var handlers = this.handlers,
			context = {
				instance: instance,
				methodName: methodName,
				arguments: args,
				error: null,
				returnValue: undefined
			};

		function next(index) {
			var handler = handlers[index];
			return function() {
				if (!handler) {
					try {
						context.returnValue = thunk.apply(instance, context.arguments);
					} catch (e) {
						context.error = e;
					}
					return;
				}

				handler(context, next(index + 1));
			};
		}

		next(0)();

		if (context.error) {
			throw context.error;
		}

		return context.returnValue;
	},

	handleCall: function(instance, methodName, args, thunk) {
		var handlers = this.handlers,
			context = {
				instance: instance,
				methodName: methodName,
				arguments: args,
				error: null,
				returnValue: undefined
			},
			arity = thunk.length;

		function next(index, prevCallback) {
			var handler = handlers[index];
			return function(callback) {
				if (!handler) {
					var args = context.arguments,
						userCallback;
					if (args.length >= arity) {
						//all arguments accounted for, assume the last argument
						//is a callback
						if (typeof(args[args.length - 1]) === 'function') {
							//last argument is a callback, we need to wrap it
							userCallback = args.pop();
						}
					}

					args.push(function(err, result) {
						if (err) {
							context.error = err;
						}
						if (result) {
							context.returnValue = result;
						}

						//this can modify the context, so it must come before we
						//set callbackArgs
						callback && callback();

						var callbackArgs = [ context.error, context.returnValue ]
							.concat([].slice.call(arguments).slice(2));

						//ugh...
						prevCallback && prevCallback();
						userCallback && userCallback.apply(null, callbackArgs);
					});

					thunk.apply(instance, args);
					return;
				}

				handler(context, next(index + 1, function() {
					prevCallback && prevCallback();
					callback && callback();
				}));
			};
		}

		next(0)();
	}
};

module.exports = Interceptor;