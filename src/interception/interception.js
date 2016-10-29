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
					if (context.error) {
						return;
					}

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
			};

		function runNestedCallbacks(next, callback) {
			return function(done) {
				if (next) {
					next(function() {
						if (callback) {
							callback(done);
						} else {
							done && done();
						}
					});
				} else if (callback) {
					callback(done);
				} else if (done) {
					done();
				}
			};
		}

		function getNextHandler(index, next) {
			var handler = handlers[index];
			return function(callback) {
				if (!handler) {
					//terminating condition, all handlers have been executed, so
					//run the original function

					var args = context.arguments,
						userCallback;

					//assume last argument is the callback
					if (typeof(args[args.length - 1]) === 'function') {
						//last argument is a callback, we need to wrap it
						userCallback = args.pop();
					}

					function runCallbacks(extraArgs) {
						function runUserCallback() {
							var callbackArgs = [ context.error, context.returnValue ].concat(extraArgs || []);
							userCallback && userCallback.apply(null, callbackArgs);
						}

						runNestedCallbacks(next, callback)(runUserCallback);
					}

					if (context.error) {
						//don't run original function if the error is already set
						runCallbacks();
						return;
					}

					args.push(function(err, result) {
						if (err) {
							context.error = err;
						}
						if (result) {
							context.returnValue = result;
						}

						runCallbacks([].slice.call(arguments, 2));
					});

					thunk.apply(instance, args);
					return;
				}

				handler(context, getNextHandler(index + 1, runNestedCallbacks(next, callback)));
			};
		}

		getNextHandler(0)();
	}
};

module.exports = Interceptor;
