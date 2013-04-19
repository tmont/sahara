var DependencyGraph = require('dep-graph'),
	lifetimes = require('./lifetime'),
	async = require('async'),
	util = require('./util');

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

function ObjectBuilder(dependencyResolver) {
	this.dependencyResolver = dependencyResolver;
}

ObjectBuilder.prototype = {
	newInstance: function(typeInfo, callback) {
		var params = typeInfo.args,
			ctor = typeInfo.ctor;

		function invokeCtor(args) {
			var instance = Object.create(ctor.prototype);
			ctor.apply(instance, args);
			return instance;
		}

		params.sort(function(a, b) {
			if (a.position === b.position) {
				return 0;
			}

			return a.position < b.position ? -1 : 1;
		});

		var self = this;
		if (callback) {
			async.map(params, function(typeData, next) {
				self.dependencyResolver(typeData.type, function(err, param) {
					process.nextTick(function() {
						next(err, param);
					});
				});
			}, function(err, args) {
				if (err) {
					callback(err);
					return;
				}

				callback(null, invokeCtor(args));
			});
		} else {
			var args = params.map(function(typeData) {
				return this.dependencyResolver(typeData.type);
			}.bind(this));

			//dynamically invoke the constructor
			return invokeCtor(args);
		}
	}
};

function Container() {
	this.registrations = {};
	this.graph = new DependencyGraph();
	this.builder = new ObjectBuilder(this.resolve.bind(this));
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
	 * @param {Function} [callback]
	 * @return {*} Nothing if callback was specified, otherwise the resolved object
	 */
	resolve: function(key, callback) {
		if (typeof(key) === 'function') {
			key = key.name;
		}

		var registration = this.registrations[key];
		if (!registration) {
			var err = new Error('Nothing with key "' + key + '" is registered in the container');
			if (callback) {
				callback(err);
				return;
			}

			throw err;
		}

		var existing = registration.lifetime.fetch();
		if (existing) {
			if (callback) {
				callback(null, existing);
				return;
			}

			return existing;
		}

		var instance, self = this;
		if (registration instanceof InstanceRegistration) {
			instance = registration.instance;
			if (callback) {
				this.inject(instance, key, function(err) {
					callback(err, instance);
				});
			} else {
				this.inject(instance, key);
				return instance;
			}
		} else if (registration instanceof TypeRegistration) {
			if (callback) {
				this.builder.newInstance(registration.typeInfo, function(err, instance) {
					if (err) {
						callback(err);
						return;
					}

					self.inject(instance, key, function(err) {
						callback(err, instance);
					});
				});
			} else {
				instance = this.builder.newInstance(registration.typeInfo);
				this.inject(instance, key);
				return instance;
			}
		} else if (registration instanceof FactoryRegistration) {
			if (callback) {
				registration.factory(this, function(err, instance) {
					if (err) {
						callback(err);
						return;
					}

					self.inject(instance, key, function(err) {
						callback(err, instance);
					});
				});
			} else {
				instance = registration.factory(this);
				this.inject(instance, key);
				return instance;
			}
		}
	},

	/**
	 * Performs injection on the given instance
	 *
	 * @param {*} instance The instance to perform injection on
	 * @param {String} key The resolution key; defaults to instance.constructor.name
	 * @param {Function} [callback]
	 */
	inject: function(instance, key, callback) {
		key = key || (instance && instance.constructor && instance.constructor.name);
		var registration = this.registrations[key];
		if (!registration) {
			var err = new Error('Nothing with key "' + key + '" is registered in the container');
			if (callback) {
				callback(err);
				return;
			}

			throw err;
		}

		var self = this;
		if (!callback) {
			registration.injections.forEach(function(injection) {
				injection.inject(instance, self);
			});
		} else {
			async.forEach(registration.injections, function(injection, next) {
				injection.inject(instance, self, function(err) {
					process.nextTick(function() {
						next(err);
					});
				});
			}, callback);
		}
	}
};

module.exports = Container;