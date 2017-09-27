const Container = require('../container');
const InterceptableObjectBuilder = require('./object-builder');

class InterceptableContainer extends Container {
	constructor(parent) {
		super(parent);
		this.builder = new InterceptableObjectBuilder(
			this.resolve.bind(this),
			this.resolveSync.bind(this)
		);
	}

	/**
	 * Configures interception
	 *
	 * @param {Function|Boolean|String|Array} matcher A predicate to determine if the
	 * function should be intercepted
	 * @param {Function...} callHandlers
	 * @return {Object} { sync: function() {}, async: function() {} }
	 */
	intercept(matcher, ...callHandlers) {
		let predicate = matcher;
		if (typeof(matcher) === 'string') {
			predicate = (instance, methodName) => methodName === matcher;
		} else if (Array.isArray(matcher)) {
			predicate = (instance, methodName) => {
				return instance instanceof matcher[0] && (!matcher[1] || matcher[1] === methodName);
			};
		} else if (typeof(matcher) !== 'function') {
			predicate = () => !!matcher
		}

		const handlerConfig = {
			handlers: callHandlers,
			matcher: predicate
		};

		return {
			sync: () => {
				handlerConfig.isAsync = false;
				this.handlerConfigs.push(handlerConfig);
				return this;
			},
			async: () => {
				handlerConfig.isAsync = true;
				this.handlerConfigs.push(handlerConfig);
				return this;
			}
		};
	}
}

module.exports = InterceptableContainer;
