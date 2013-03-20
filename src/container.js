var DependencyGraph = require('dep-graph'),
	lifetimes = require('./lifetime'),
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

function ObjectBuilder(dependencyResolver) {
	this.dependencyResolver = dependencyResolver;
}

ObjectBuilder.prototype = {
	newInstance: function(typeInfo) {
		var params = typeInfo.args,
			ctor = typeInfo.ctor;

		params.sort(function(a, b) {
			if (a.position === b.position) {
				return 0;
			}

			return a.position < b.position ? -1 : 1;
		});

		var args = params.map(function(typeData) {
			return this.dependencyResolver(typeData.type);
		}.bind(this));

		//dynamically invoke the constructor
		var instance = Object.create(ctor.prototype);
		ctor.apply(instance, args);
		return instance;
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
	 * @param {Object} [options]
	 * @param {String} [options.key] The resolution key; defaults to ctor.name
	 * @param {Object} [options.lifetime] The lifetime manager of this object, defaults
	 * to sahara.Lifetime.Transient
	 * @param {Object[]} [options.injections] Array of injections to perform upon resolution
	 * @return {Container}
	 */
	registerType: function(ctor, options) {
		options = options || {};
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
	 * @param {Object} [options]
	 * @param {String} [options.key] The resolution key; defaults to instance.constructor.name
	 * @param {Object} [options.lifetime] The lifetime manager of this object, defaults
	 * to sahara.Lifetime.Transient
	 * @param {Object[]} [options.injections] Array of injections to perform upon resolution
	 * @return {Container}
	 */
	registerInstance: function(instance, options) {
		options = options || {};
		var typeName = options.key || (instance && instance.constructor && instance.constructor.name);
		this.registrations[typeName] = new InstanceRegistration(
			typeName,
			options.lifetime,
			options.injections,
			instance
		);
		return this;
	},

	/**
	 * Resolves a type to an instance
	 *
	 * @param {String|Function} key The resolution key or constructor to resolve
	 * @return {*}
	 */
	resolve: function(key) {
		if (typeof(key) === 'function') {
			key = key.name;
		}

		var registration = this.registrations[key];
		if (!registration) {
			throw new Error('Nothing with key "' + key + '" is registered in the container');
		}

		var existing = registration.lifetime.fetch();
		if (existing) {
			return existing;
		}

		var instance = registration instanceof InstanceRegistration
			? registration.instance
			: this.builder.newInstance(registration.typeInfo);

		this.inject(instance, key);
		registration.lifetime.store(instance);
		return instance;
	},

	/**
	 * Performs injection on the given instance
	 *
	 * @param {*} instance The instance to perform injection on
	 * @param {String} key The resolution key; defaults to instance.constructor.name
	 */
	inject: function(instance, key) {
		key = key || (instance && instance.constructor && instance.constructor.name);
		var registration = this.registrations[key];
		if (!registration) {
			throw new Error('Nothing with key "' + key + '" is registered in the container');
		}

		registration.injections.forEach(function(injection) {
			injection.inject(instance, this);
		}.bind(this));
	}
};

module.exports = Container;