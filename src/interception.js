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

	handleCall: function(instance, methodName, args, callback) {

	}
};

module.exports = Interceptor;