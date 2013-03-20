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
	 * @param {String} [name] The name of the type; required if a named function is not given
	 * @param {Object} [lifetime] The lifetime manager for this type, defaults to
	 * sahara.Lifetime.Transient
     * @param {Injection[]} [injections] Array of injections to perform upon resolution
	 * @return {Container}
	 */
	registerType: function(ctor, name, lifetime, injections) {
		var typeInfo = util.getTypeInfo(ctor, name),
			typeName = typeInfo.name;

		this.registrations[typeName] = new TypeRegistration(typeName, lifetime, injections, typeInfo);

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
	 * @param {String} typeName The name of the instance
	 * @param {*} instance The instance to store
	 * @param {Object} [lifetime] The lifetime manager of this object, defaults
	 * to sahara.Lifetime.Transient
	 * @param {Injection[]} [injections] Array of injections to perform upon resolution
	 * @return {Container}
	 */
	registerInstance: function(typeName, instance, lifetime, injections) {
		if (instance === undefined) {
			throw new TypeError('No instance given');
		}

		this.registrations[typeName] = new InstanceRegistration(typeName, lifetime, injections, instance);
		return this;
	},

	/**
	 * Resolves a type to an instance
	 *
	 * @param {String} typeName The type to resolve
	 * @return {*}
	 */
	resolve: function(typeName) {
		var registration = this.registrations[typeName];
		if (!registration) {
			throw new Error('The type "' + typeName + '" is not registered in the container');
		}

		var existing = registration.lifetime.fetch();
		if (existing) {
			return existing;
		}

		var instance = registration instanceof InstanceRegistration
			? registration.instance
			: this.builder.newInstance(registration.typeInfo);

		this.inject(typeName, instance);
		registration.lifetime.store(instance);
		return instance;
	},

	/**
	 * Performs injection on the given instance
	 *
	 * @param {String} typeName The name of the type to perform injection for
	 * @param {*} instance The instance to perform injection on
	 */
	inject: function(typeName, instance) {
		var registration = this.registrations[typeName];
		if (!registration) {
			throw new Error('The type "' + typeName + '" is not registered in the container');
		}

		registration.injections.forEach(function(injection) {
			injection.inject(instance, this);
		}.bind(this));
	}
};

module.exports = Container;