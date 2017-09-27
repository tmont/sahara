class Interceptor {
	constructor(handlers) {
		this.handlers = handlers;
	}

	handleCallSync(instance, methodName, args, thunk) {
		const handlers = this.handlers;
		const context = {
			instance: instance,
			methodName: methodName,
			arguments: args,
			error: null,
			returnValue: undefined
		};

		const next = (index) => {
			const handler = handlers[index];
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
		};

		next(0)();

		if (context.error) {
			throw context.error;
		}

		return context.returnValue;
	}

	handleCall(instance, methodName, args, thunk) {
		const handlers = this.handlers;
		const context = {
			instance: instance,
			methodName: methodName,
			arguments: args,
			error: null,
			returnValue: undefined
		};

		const runNestedCallbacks = (next, callback) => {
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
		};

		const getNextHandler = (index, next) => {
			const handler = handlers[index];
			return (callback) => {
				if (!handler) {
					//terminating condition, all handlers have been executed, so
					//run the original function

					const args = context.arguments;
					let userCallback;

					//assume last argument is the callback
					if (typeof(args[args.length - 1]) === 'function') {
						//last argument is a callback, we need to wrap it
						userCallback = args.pop();
					}

					const runCallbacks = (extraArgs) => {
						function runUserCallback() {
							const callbackArgs = [ context.error, context.returnValue ].concat(extraArgs || []);
							userCallback && userCallback.apply(null, callbackArgs);
						}

						runNestedCallbacks(next, callback)(runUserCallback);
					};

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
		};

		getNextHandler(0)();
	}
}

module.exports = Interceptor;
