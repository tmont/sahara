var DependencyGraph = require('dep-graph');

function Container() {
	this.registrations = {};
	this.instances = {};
	this.graph = new DependencyGraph();
}

Container.prototype = {
	registerType: function(ctor, name) {
		var data = /^function(?:[\s+](\w+))?\s*\((.*?)\)\s*\{/.exec(ctor.toString());
		if (!data) {
			throw new Error('Unable to parse function definition: ' + ctor.toString());
		}

		var typeName = data[1] || name,
			signature = data[2].trim();
		if (!typeName) {
			throw new Error('"name" must be given if a named function is not');
		}

		var typeData = {
			args: [],
			ctor: ctor
		};

		if (signature) {
			signature.split(',').forEach(function(param, i) {
				//ferret out the type of each argument based on inline jsdoc:
				//https://code.google.com/p/jsdoc-toolkit/wiki/InlineDocs
				var data = /^\/\*\*\s*(\w+)\s*\*\/\s*(\w+)\s*$/.exec(param.trim());
				if (!data) {
					throw new Error(
						'Unable to determine type of parameter at position ' + (i + 1) +
							' for type "' + typeName + '"'
					);
				}

				typeData.args.push({
					position: i,
					type: data[1],
					name: data[2]
				});
			});
		}

		this.registrations[typeName] = typeData;

		//add to the dependency graph to verify that there are no
		//circular dependencies (the graph isn't used anywhere else)
		for (var i = 0; i < typeData.args.length; i++) {
			this.graph.add(typeName, typeData.args[i].type);
		}
		//the graph isn't actually built until you try to get the chain
		this.graph.getChain(typeName);

		return this;
	},

	registerInstance: function(typeName, instance) {
		if (instance === undefined) {
			throw new TypeError('No instance given');
		}

		this.instances[typeName] = instance;
		return this;
	},

	resolve: function(typeName) {
		var instance = this.instances[typeName];
		if (instance) {
			return instance;
		}

		if (!this.registrations[typeName]) {
			throw new Error('The type "' + typeName + '" is not registered in the container');
		}

		//resolve dependencies
		var registration = this.registrations[typeName],
			params = registration.args,
			ctor = registration.ctor;

		params.sort(function(a, b) {
			if (a.position === b.position) {
				return 0;
			}

			return a.position < b.position ? -1 : 1;
		});

		var container = this,
			args = params.map(function(typeData) { return container.resolve(typeData.type); });

		//dynamically invoke the constructor
		instance = Object.create(ctor.prototype);
		ctor.apply(instance, args);
		return instance;
	}
};

module.exports = Container;