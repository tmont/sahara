var Container = require('../container'),
	InterceptableObjectBuilder = require('./object-builder'),
	merge = require('../merge');

function InterceptableContainer() {
	Container.apply(this, arguments);

	this.builder = new InterceptableObjectBuilder(
		this.resolve.bind(this),
		this.resolveSync.bind(this)
	);
}

merge(InterceptableContainer.prototype, Container.prototype, {
	/**
	 * Configures interception
	 *
	 * @param {Function|Boolean|String|Array} matcher A predicate to determine if the
	 * function should be intercepted
	 * @param {Function...} callHandler
	 * @return {Object} { sync: function() {}, async: function() {} }
	 */
	intercept: function(matcher, callHandler) {
		var predicate = matcher;
		if (typeof(matcher) === 'string') {
			predicate = function(instance, methodName) {
				return methodName === matcher;
			};
		} else if (Array.isArray(matcher)) {
			predicate = function(instance, methodName) {
				return instance instanceof matcher[0] && (!matcher[1] || matcher[1] === methodName);
			};
		} else if (typeof(matcher) !== 'function') {
			matcher = !!matcher;
			predicate = function() {
				return matcher;
			};
		}

		var handlers = [].slice.call(arguments, 1),
			handlerConfig = {
				handlers: handlers,
				matcher: predicate
			};

		var container = this;
		return {
			sync: function() {
				handlerConfig.isAsync = false;
				container.handlerConfigs.push(handlerConfig);
				return container;
			},
			async: function() {
				handlerConfig.isAsync = true;
				container.handlerConfigs.push(handlerConfig);
				return container;
			}
		};
	}
});

module.exports = InterceptableContainer;
