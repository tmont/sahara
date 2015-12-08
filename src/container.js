var DependencyGraph = require('dep-graph'),
	ObjectBuilder = require('./builder'),
	lifetimes = require('./lifetime'),
	async = require('async'),
	util = require('util'),
	EventEmitter = require('events').EventEmitter,
	utils = require('./util');

function createUnregisteredError(key, context) {
	var message = 'Nothing with key "' + key + '" is registered in the container';
	if (context && context.history.length) {
		message += '; error occurred while resolving ';
		message += context.history.concat([{ name: key }])
			.map(function(registration, i) {
				return '"' + registration.name + '"';
			})
			.join(' -> ');
	}

	return new Error(message);
}

function createResolverContext() {
	return {
		history: []
	};
}

function getKeyFromCtor(ctor) {
	return ctor.name;
}
function getKeyFromInstance(instance) {
	return instance && instance.constructor && instance.constructor.name;
}

function Registration(name, lifetime, injections) {
	this.name = name;
	this.lifetime = lifetime || new lifetimes.Transient();
	this.injections = injections || [];
}

function TypeRegistration(name, lifetime, injections, typeInfo) {
	Registration.call(this, name, lifetime, injections);
	this.typeInfo = typeInfo;
}

function InstanceRegistration(name, lifetime, injections, instance) {
	Registration.call(this, name, lifetime, injections);
	this.instance = instance;
}

function FactoryRegistration(name, lifetime, injections, factory) {
	Registration.call(this, name, lifetime, injections);
	this.factory = factory;
}

function Container(parent) {
	this.parent = parent || null;
	this.registrations = {};
	this.handlerConfigs = [];
	this.graph = new DependencyGraph();
	this.builder = new ObjectBuilder(
		this.resolve.bind(this),
		this.resolveSync.bind(this)
	);
}

util.inherits(Container, EventEmitter);

function resolveSignatureToOptions(args) {
	args = [].slice.call(args, 1);

	if (args.length === 0) {
		return {};
	}

	//just a regular options object (making sure to check for null!)
	if (args[0] && typeof(args[0]) === 'object') {
		return args[0];
	}

	var options = {};
	if (typeof(args[0]) === 'string') {
		options.key = args[0];
	}
	if (args[1]) {
		options.lifetime = args[1];
	}

	options.injections = args.slice(2);

	return options;
}

util._extend(Container.prototype, {
	/**
	 * Registers a type from a constructor
	 *
	 * @param {Function} ctor The constructor of the type to register
	 * @param {String} [key] The resolution key
	 * @param {Object} [lifetime] The lifetime manager of this object, defaults
	 * to sahara.Lifetime.Transient
	 * @param {Object...} [injections] Injections to perform upon resolution
	 * @return {Container}
	 */
	registerType: function(ctor, key, lifetime, injections) {
		var options = resolveSignatureToOptions(arguments);
		var typeInfo = utils.getTypeInfo(ctor, options.key),
			typeName = typeInfo.name;

		this.emit('registering', typeName, 'type');
		this.registrations[typeName] = new TypeRegistration(
			typeName,
			options.lifetime,
			options.injections,
			typeInfo
		);

		//add to the dependency graph to verify that there are no
		//circular dependencies (the graph isn't used anywhere else)
		for (var i = 0; i < typeInfo.args.length; i++) {
			this.graph.add(typeName, typeInfo.args[i].type);
		}

		//the graph isn't actually built until you try to get the chain
		this.graph.getChain(typeName);

		return this;
	},

	/**
	 * Registers a specific instance of a type
	 *
	 * @param {Object} instance The instance to store
	 * @param {String} [key] The resolution key
	 * @param {Object} [lifetime] The lifetime manager of this object, defaults
	 * to sahara.Lifetime.Transient
	 * @param {Object...} [injections] Injections to perform upon resolution
	 * @return {Container}
	 */
	registerInstance: function(instance, key, lifetime, injections) {
		var options = resolveSignatureToOptions(arguments);
		options.key = options.key || getKeyFromInstance(instance);
		this.emit('registering', options.key, 'instance');
		this.registrations[options.key] = new InstanceRegistration(
			options.key,
			options.lifetime,
			options.injections,
			instance
		);

		return this;
	},

	/**
	 * Registers a factory function for a type that will create
	 * the object
	 *
	 * @param {Function} factory A function that creates the object; this function
	 * should take one parameter, the container
	 * @param {String} [key] The resolution key
	 * @param {Object} [lifetime] The lifetime manager of this object, defaults
	 * to sahara.Lifetime.Transient
	 * @param {Object...} [injections] Injections to perform upon resolution
	 * @return {Container}
	 */
	registerFactory: function(factory, key, lifetime, injections) {
		var options = resolveSignatureToOptions(arguments);
		if (!options.key) {
			throw new Error('"options.key" must be passed to registerFactory()');
		}

		this.emit('registering', options.key, 'factory');
		this.registrations[options.key] = new FactoryRegistration(
			options.key,
			options.lifetime,
			options.injections,
			factory
		);
		return this;
	},

	/**
	 * Determines if something is registered with the given key
	 * @param {String|Function} key The resolution key or constructor
	 * @return {Boolean}
	 */
	isRegistered: function(key) {
		if (typeof(key) === 'function') {
			key = getKeyFromCtor(key);
		}

		return !!this.registrations[key];
	},

	/**
	 * Resolves a type to an instance
	 *
	 * @param {String|Function} key The resolution key or constructor to resolve
	 * @param {Object} [context]
	 * @param {Function} callback
	 */
	resolve: function(key, context, callback) {
		if (typeof(key) === 'function') {
			key = getKeyFromCtor(key);
		}

		if (typeof(context) === 'function') {
			callback = context;
			context = null;
		}

		context = context || createResolverContext();

		this.emit('resolving', key);
		var registration = this.registrations[key];
		if (!registration) {
			callback(createUnregisteredError(key, context));
			return;
		}

		context.history.push(registration);

		var existing = registration.lifetime.fetch();
		if (existing) {
			this.emit('resolved', key, existing);
			callback(null, existing);
			return;
		}

		var self = this;
		function injectAndReturn(err, instance) {
			if (err) {
				callback(err);
				return;
			}

			self.inject(instance, key, function(err) {
				if (!err) {
					registration.lifetime.store(instance);
				}

				self.emit('resolved', key, instance);
				callback(err, instance);
			});
		}

		if (registration instanceof InstanceRegistration) {
			injectAndReturn(null, registration.instance);
		} else if (registration instanceof TypeRegistration) {
			this.builder.newInstance(registration.typeInfo, this.handlerConfigs, context, injectAndReturn);
		} else if (registration instanceof FactoryRegistration) {
			registration.factory(this, injectAndReturn);
		}
	},

	/**
	 * Resolve a type to an instance synchronously
	 *
	 * @param {String|Function} key The resolution key or constructor to resolve
	 * @param {Object} [context] Resolver context used internally
	 * @return {*} The resolved object
	 */
	resolveSync: function(key, context) {
		if (typeof(key) === 'function') {
			key = getKeyFromCtor(key);
		}
		context = context || createResolverContext();

		var registration = this.registrations[key];
		this.emit('resolving', key);
		if (!registration) {
			throw createUnregisteredError(key, context);
		}

		context.history.push(registration);

		var existing = registration.lifetime.fetch();
		if (existing) {
			this.emit('resolved', key, existing);
			return existing;
		}

		var instance;
		if (registration instanceof InstanceRegistration) {
			instance = registration.instance;
		} else if (registration instanceof TypeRegistration) {
			instance = this.builder.newInstanceSync(registration.typeInfo, this.handlerConfigs, context);
		} else if (registration instanceof FactoryRegistration) {
			instance = registration.factory(this);
		}

		this.injectSync(instance, key);
		registration.lifetime.store(instance);
		this.emit('resolved', key, instance);
		return instance;
	},

	/**
	 * Same as resolveSync(), but won't ever throw
	 * @param key
	 * @return {*} The resolved object, or undefined if the key doesn't exist
	 */
	tryResolveSync: function(key) {
		try {
			return this.resolveSync(key);
		} catch (e) {
			return undefined;
		}
	},

	/**
	 * Performs injection on an object
	 *
	 * @param {*} instance The object to perform injection on
	 * @param {String} key The resolution key; defaults to instance.constructor.name
	 * @param {Function} callback
	 */
	inject: function(instance, key, callback) {
		key = key || getKeyFromInstance(instance);
		var registration = this.registrations[key];
		if (!registration) {
			callback(createUnregisteredError(key));
			return;
		}

		var self = this;
		async.each(registration.injections, function(injection, next) {
			injection.inject(instance, self, next);
		}, callback);
	},

	/**
	 * Performs injection on an object synchronously
	 *
	 * @param {*} instance The object to perform injection on
	 * @param {String} [key] The resolution key; defaults to instance.constructor.name
	 */
	injectSync: function(instance, key) {
		key = key || getKeyFromInstance(instance);
		var registration = this.registrations[key];
		if (!registration) {
			throw createUnregisteredError(key);
		}

		var self = this;
		registration.injections.forEach(function(injection) {
			injection.injectSync(instance, self);
		});
	},

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
	},

	/**
	 * Creates a clone of the container in its current state
	 *
	 * @param {Boolean} withEvents
	 * @returns {Container}
	 */
	createChildContainer: function(withEvents) {
		var childContainer = new Container(this),
			self = this;

		Object.keys(this.registrations).forEach(function(key) {
			childContainer.registrations[key] = self.registrations[key];
		});

		Object.keys(this.graph.map).forEach(function(key) {
			childContainer.graph.map[key] = self.graph.map[key];
		});

		this.handlerConfigs.forEach(function(config) {
			childContainer.handlerConfigs.push(config);
		});

		if (withEvents) {
			[ 'registering', 'resolving', 'resolved' ].forEach(function(event) {
				self.listeners(event).forEach(function(listener) {
					childContainer.on(event, listener);
				});
			});

			[ 'building', 'built', 'intercepting' ].forEach(function(event) {
				self.builder.listeners(event).forEach(function(listener) {
					childContainer.builder.on(event, listener);
				});
			});
		}

		return childContainer;
	}
});

module.exports = Container;
