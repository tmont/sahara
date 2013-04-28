var DependencyGraph = require('dep-graph'),
	ObjectBuilder = require('./builder'),
	lifetimes = require('./lifetime'),
	async = require('async'),
	util = require('./util');

function createUnregisteredError(key) {
	return new Error('Nothing with key "' + key + '" is registered in the container');
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

function Container() {
	this.registrations = {};
	this.graph = new DependencyGraph();
	this.builder = new ObjectBuilder(
		this.resolve.bind(this),
		this.resolveSync.bind(this)
	);
}

Container.prototype = {
	/**
	 * Registers a type from a constructor
	 *
	 * @param {Function} ctor The constructor of the type to register
	 * @param {Object|String} [options]
	 * @param {String} [options.key] The resolution key
	 * @param {Object} [options.lifetime] The lifetime manager of this object, defaults
	 * to sahara.Lifetime.Transient
	 * @param {Object[]} [options.injections] Array of injections to perform upon resolution
	 * @return {Container}
	 */
	registerType: function(ctor, options) {
		options = options || {};
		if (typeof(options) === 'string') {
			options = { key: options };
		}
		var typeInfo = util.getTypeInfo(ctor, options.key),
			typeName = typeInfo.name;

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
	 * @param {Object|String} [options]
	 * @param {String} [options.key] The resolution key; defaults to instance.constructor.name
	 * @param {Object} [options.lifetime] The lifetime manager of this object, defaults
	 * to sahara.Lifetime.Transient
	 * @param {Object[]} [options.injections] Array of injections to perform upon resolution
	 * @return {Container}
	 */
	registerInstance: function(instance, options) {
		options = options || {};
		if (typeof(options) === 'string') {
			options = { key: options };
		}
		var key = options.key || (instance && instance.constructor && instance.constructor.name);
		this.registrations[key] = new InstanceRegistration(
			key,
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
	 * @param {Object|String} options
	 * @param {String} options.key The resolution key
	 * @param {Object} [options.lifetime] The lifetime manager of this object, defaults
	 * to sahara.Lifetime.Transient
	 * @param {Object[]} [options.injections] Array of injections to perform upon resolution
	 * @return {Container}
	 */
	registerFactory: function(factory, options) {
		options = options || {};
		if (typeof(options) === 'string') {
			options = { key: options };
		}
		if (!options.key) {
			throw new Error('"options.key" must be passed to registerFactory()');
		}

		this.registrations[options.key] = new FactoryRegistration(
			options.key,
			options.lifetime,
			options.injections,
			factory
		);
		return this;
	},

	/**
	 * Resolves a type to an instance
	 *
	 * @param {String|Function} key The resolution key or constructor to resolve
	 * @param {Function} callback
	 */
	resolve: function(key, callback) {
		if (typeof(key) === 'function') {
			key = getKeyFromCtor(key);
		}

		var registration = this.registrations[key];
		if (!registration) {
			callback(createUnregisteredError(key));
			return;
		}

		var existing = registration.lifetime.fetch();
		if (existing) {
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

				callback(err, instance);
			});
		}

		if (registration instanceof InstanceRegistration) {
			injectAndReturn(null, registration.instance);
		} else if (registration instanceof TypeRegistration) {
			this.builder.newInstance(registration.typeInfo, injectAndReturn);
		} else if (registration instanceof FactoryRegistration) {
			registration.factory(this, injectAndReturn);
		}
	},

	/**
	 * Resolve a type to an instance synchronously
	 *
	 * @param {String|Function} key The resolution key or constructor to resolve
	 * @return {*} The resolved object
	 */
	resolveSync: function(key) {
		if (typeof(key) === 'function') {
			key = getKeyFromCtor(key);
		}

		var registration = this.registrations[key];
		if (!registration) {
			throw createUnregisteredError(key);
		}

		var existing = registration.lifetime.fetch();
		if (existing) {
			return existing;
		}

		var instance;
		if (registration instanceof InstanceRegistration) {
			instance = registration.instance;
		} else if (registration instanceof TypeRegistration) {
			instance = this.builder.newInstanceSync(registration.typeInfo);
		} else if (registration instanceof FactoryRegistration) {
			instance = registration.factory(this);
		}

		this.injectSync(instance, key);
		registration.lifetime.store(instance);
		return instance;
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
		async.forEach(registration.injections, function(injection, next) {
			injection.inject(instance, self, function(err) {
				process.nextTick(function() {
					next(err);
				});
			});
		}, callback);
	},

	/**
	 * Performs injection on an object synchronously
	 *
	 * @param {*} instance The object to perform injection on
	 * @param {String} [key] The resolution key
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
	}
};

module.exports = Container;