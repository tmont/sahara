(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.sahara = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
function Vertex(name, successors) {
	this.name = name;
	this.successors = successors;
	this.reset();
}

Vertex.prototype = {
	reset: function() {
		this.index = -1;
		this.lowLink = -1;
		this.onStack = false;
		this.visited = false;
	}
};

function Graph() {
	this.vertices = {};
}

Graph.prototype = {
	add: function(key, descendants) {
		var self = this;

		descendants = Array.isArray(descendants) ? descendants : [ descendants ];

		var successors = descendants.map(function(key) {
			if (!self.vertices[key]) {
				self.vertices[key] = new Vertex(key, []);
			}
			return self.vertices[key];
		});

		if (!this.vertices[key]) {
			this.vertices[key] = new Vertex(key);
		}

		this.vertices[key].successors = successors.concat([]).reverse();
		return this;
	},

	reset: function() {
		var self = this;
		Object.keys(this.vertices).forEach(function(key) {
			self.vertices[key].reset();
		});
	},

	addAndVerify: function(key, dependencies) {
		this.add(key, dependencies);
		var cycles = this.getCycles();
		if (cycles.length) {
			var message = 'Detected ' + cycles.length + ' cycle' + (cycles.length === 1 ? '' : 's') + ':';
			message += '\n' + cycles.map(function(scc) {
				var names = scc.map(function(v) { return v.name; });
				return '  ' + names.join(' -> ') + ' -> ' + names[0];
			}).join('\n');

			var err = new Error(message);
			err.cycles = cycles;
			throw err;
		}

		return this;
	},

	dfs: function(key, visitor) {
		this.reset();
		var stack = [ this.vertices[key] ],
			v;
		while (v = stack.pop()) {
			if (v.visited) {
				continue;
			}

			//pre-order traversal
			visitor(v);
			v.visited = true;

			v.successors.forEach(function(w) {
				stack.push(w);
			});
		}
	},

	getDescendants: function(key) {
		var descendants = [],
			ignore = true;
		this.dfs(key, function(v) {
			if (ignore) {
				//ignore the first node
				ignore = false;
				return;
			}
			descendants.push(v.name);
		});
		return descendants;
	},

	hasCycle: function() {
		return this.getCycles().length > 0;
	},

	getStronglyConnectedComponents: function() {
		var self = this;

		var V = Object.keys(self.vertices).map(function(key) {
			self.vertices[key].reset();
			return self.vertices[key];
		});

		var index = 0,
			stack = [],
			components = [];

		function stronglyConnect(v) {
			v.index = index;
			v.lowLink = index;
			index++;
			stack.push(v);
			v.onStack = true;

			v.successors.forEach(function(w) {
				if (w.index < 0) {
					stronglyConnect(w);
					v.lowLink = Math.min(v.lowLink, w.lowLink);
				} else if (w.onStack) {
					v.lowLink = Math.min(v.lowLink, w.index);
				}
			});

			if (v.lowLink === v.index) {
				var scc = [];
				do {
					var w = stack.pop();
					w.onStack = false;
					scc.push(w);
				} while (w !== v);

				components.push(scc);
			}
		}

		V.forEach(function(v) {
			if (v.index < 0) {
				stronglyConnect(v);
			}
		});

		return components;
	},

	getCycles: function() {
		return this.getStronglyConnectedComponents().filter(function(scc) {
			return scc.length > 1;
		});
	},

	clone: function() {
		var graph = new Graph(),
			self = this;

		Object.keys(this.vertices).forEach(function(key) {
			var v = self.vertices[key];
			graph.add(v.name, v.successors.map(function(w) {
				return w.name;
			}));
		});

		return graph;
	},

	toDot: function() {
		var V = this.vertices,
		lines = [ 'digraph {' ];

		var cycles = this.getCycles();
		cycles.forEach(function(scc, i) {
			lines.push('  subgraph cluster' + i + ' {');
			lines.push('    color=red;');
			lines.push('    ' + scc.map(function(v) { return v.name; }).join('; ') + ';');
			lines.push('  }');
		});

		Object.keys(V).forEach(function(key) {
			var v = V[key];
			if (v.successors.length) {
				v.successors.forEach(function(w) {
					lines.push('  ' + v.name + ' -> ' + w.name);
				});
			}
		});

		lines.push('}');
		return lines.join('\n') + '\n';
	}
};

module.exports = Graph;

},{}],2:[function(require,module,exports){
var noError = null;

function map(arr, iterator, series, callback) {
	var mapped = new Array(arr.length);
	var finished = 0;
	var expected = arr.length;
	var error = noError;

	if (!arr.length) {
		callback(noError, mapped);
		return;
	}

	function finish(index, err, result) {
		finished++;

		if (err) {
			error = error || err;
		} else {
			mapped[index] = result;
		}

		if (expected === finished) {
			callback(error, error ? null : mapped);
		} else if (series) {
			setImmediate(function() {
				run(index + 1);
			}, 1);
		}
	}

	function run(index) {
		var item = arr[index];
		if (!item) {
			finish(index);
			return;
		}

		iterator(item, finish.bind(null, index));
	}

	if (series) {
		run(0);
	} else {
		arr.forEach(function(value, i) {
			run(i);
		});
	}
}

module.exports = {
	each: function(arr, iterator, callback) {
		map(arr, iterator, false, function(err) {
			callback(err);
		});
	},

	map: function(arr, iterator, callback) {
		map(arr, iterator, false, callback);
	},

	mapSeries: function(arr, iterator, callback) {
		map(arr, iterator, true, callback);
	},

	series: function(thunks, callback) {
		function iterator(thunk, next) {
			thunk(next);
		}

		map(thunks, iterator, true, function(err) {
			callback(err);
		});
	}
};

},{}],3:[function(require,module,exports){
var Graph = require('tarjan-graph'),
	ObjectBuilder = require('./object-builder'),
	lifetimes = require('./lifetime'),
	async = require('./async'),
	merge = require('./merge'),
	EventEmitter = require('./event-emitter'),
	utils = require('./util');

function createUnregisteredError(key, context) {
	var message = 'Nothing with key "' + key + '" is registered in the container';
	if (context && context.history.length) {
		message += '; error occurred while resolving ';
		message += context.history.concat([{ name: key }])
			.map(function(registration) {
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
	EventEmitter.call(this);
	this.parent = parent || null;
	this.registrations = {};
	this.handlerConfigs = [];
	this.graph = new Graph();
	this.builder = new ObjectBuilder(
		this.resolve.bind(this),
		this.resolveSync.bind(this)
	);

	this.registerInstance(this);
}

merge(Container.prototype, EventEmitter.prototype, {
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

		try {
			this.graph.addAndVerify(typeName, typeInfo.args.map(function(info) {
				return info.type;
			}));
		} catch (e) {
			throw new Error(typeName + '\'s dependencies create a cycle: ' + e.message);
		}

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

			context.history.pop();

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

		context.history.pop();

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
	 * Creates a clone of the container in its current state
	 *
	 * @param {Boolean} withEvents
	 * @returns {Container}
	 */
	createChildContainer: function(withEvents) {
		var childContainer = new this.constructor(this),
			self = this;

		Object.keys(this.registrations).forEach(function(key) {
			childContainer.registrations[key] = self.registrations[key];
		});

		childContainer.graph = this.graph.clone();

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

},{"./async":2,"./event-emitter":4,"./lifetime":7,"./merge":8,"./object-builder":9,"./util":10,"tarjan-graph":1}],4:[function(require,module,exports){
function EventEmitter() {
	this.events = {};
}

EventEmitter.prototype = {
	listeners: function(name) {
		if (!this.events[name]) {
			this.events[name] = [];
		}

		return this.events[name];
	},

	on: function(name, listener) {
		this.listeners(name).push(listener);
	},

	off: function(name, listener) {
		var listeners = this.listeners(name);
		var index = listeners.indexOf(listener);
		if (index !== -1) {
			listeners.splice(index, 1);
		}
	},

	emit: function(name) {
		var args = [].slice.call(arguments, 1);
		this.listeners(name).forEach(function(listener) {
			listener.apply(this, args);
		});
	}
};

module.exports = EventEmitter;

},{}],5:[function(require,module,exports){
var injection = require('./injection'),
	lifetime = require('./lifetime');

module.exports = {
	Container: require('./container'),
	inject: {
		propertyValue: function(name, value) {
			return new injection.PropertyValue(name, value);
		},
		property: function(name, key) {
			return new injection.Property(name, key);
		},
		method: function(name, args) {
			return new injection.Method(name, args);
		}
	},
	lifetime: {
		transient: function() {
			return new lifetime.Transient();
		},
		memory: function() {
			return new lifetime.Memory();
		}
	}
};

},{"./container":3,"./injection":6,"./lifetime":7}],6:[function(require,module,exports){
var util = require('./util'),
	async = require('./async');

function PropertyValueInjection(name, value) {
	this.name = name;
	this.value = value;
}

PropertyValueInjection.prototype = {
	injectSync: function(object, container) {
		object[this.name] = this.value;
	},

	inject: function(object, container, callback) {
		this.injectSync(object, container);
		callback && callback();
	}
};

function PropertyInjection(name, key) {
	this.name = name;
	this.key = key;
}

PropertyInjection.prototype = {
	injectSync: function(object, container) {
		object[this.name] = container.resolveSync(this.key);
	},

	inject: function(object, container, callback) {
		var name = this.name;
		container.resolve(this.key, function(err, instance) {
			if (err) {
				callback(err);
				return;
			}

			object[name] = instance;
			callback();
		});
	}
};

function MethodInjection(name, args) {
	this.name = name;
	this.args = args;
}

MethodInjection.prototype = {
	createError: function() {
		return new Error(
			'Cannot perform method injection because the object does ' +
				'not have a method "' + this.name + '"'
		);
	},

	injectSync: function(object, container) {
		if (!object[this.name] || typeof(object[this.name]) !== 'function') {
			throw this.createError();
		}

		var args = this.args, name = this.name;
		if (!args) {
			args = util.getTypeInfo(object[name], name).args;
			args = args.map(function(argInfo) {
				return container.resolveSync(argInfo.type);
			});
		}

		object[name].apply(object, args);
	},

	inject: function(object, container, callback) {
		if (!object[this.name] || typeof(object[this.name]) !== 'function') {
			callback(this.createError());
			return;
		}

		function applyArgs(err, args) {
			if (err) {
				callback(err);
				return;
			}

			object[name].apply(object, args);
			callback();
		}

		var args = this.args, name = this.name;
		if (args) {
			applyArgs(null, args);
			return;
		}

		args = util.getTypeInfo(object[name], name).args;
		async.map(args, function(argInfo, next) {
			container.resolve(argInfo.type, next);
		}, applyArgs);
	}
};

module.exports = {
	Property: PropertyInjection,
	PropertyValue: PropertyValueInjection,
	Method: MethodInjection
};

},{"./async":2,"./util":10}],7:[function(require,module,exports){
function MemoryLifetime() {
	this.value = null;
}

MemoryLifetime.prototype = {
	fetch: function() {
		return this.value;
	},

	store: function(value) {
		this.value = value;
	}
};

function TransientLifetime() {}
TransientLifetime.prototype = {
	fetch: function() {
		return null;
	},

	store: function(value) {}
};

module.exports = {
	Memory: MemoryLifetime,
	Transient: TransientLifetime
};

},{}],8:[function(require,module,exports){
module.exports = function(obj) {
	var original = obj || {};
	var others = [].slice.call(arguments, 1);

	for (var i = 0; i < others.length; i++) {
		var other = others[i];
		for (var key in other) {
			if (!other.hasOwnProperty(key)) {
				continue;
			}

			original[key] = other[key];
		}
	}


	return original;
};

},{}],9:[function(require,module,exports){
var async = require('./async'),
	merge = require('./merge'),
	EventEmitter = require('./event-emitter');

function getParams(typeInfo) {
	var params = typeInfo.args;
	params.sort(function(a, b) {
		if (a.position === b.position) {
			return 0;
		}

		return a.position < b.position ? -1 : 1;
	});

	return params;
}

function ObjectBuilder(resolver, resolverSync) {
	EventEmitter.call(this);
	this.resolver = resolver;
	this.resolverSync = resolverSync;
}

merge(ObjectBuilder.prototype, EventEmitter.prototype, {
	invokeCtor: function(ctor, handlerConfigs, args) {
		return new (Function.prototype.bind.apply(ctor, [null].concat(args)))();
	},

	newInstanceSync: function(typeInfo, handlerConfigs, context) {
		this.emit('building', typeInfo);
		var args = getParams(typeInfo).map(function(typeData) {
			return this.resolverSync(typeData.type, context);
		}.bind(this));

		var instance = this.invokeCtor(typeInfo.ctor, handlerConfigs, args);
		this.emit('built', typeInfo, instance);
		return instance;
	},

	newInstance: function(typeInfo, handlerConfigs, context, callback) {
		this.emit('building', typeInfo);
		var self = this;
		async.mapSeries(getParams(typeInfo), function(typeData, next) {
			self.resolver(typeData.type, context, next);
		}, function(err, args) {
			if (err) {
				callback(err);
				return;
			}

			var instance = self.invokeCtor(typeInfo.ctor, handlerConfigs, args);
			self.emit('built', typeInfo, instance);
			callback(null, instance);
		});
	}
});

module.exports = ObjectBuilder;

},{"./async":2,"./event-emitter":4,"./merge":8}],10:[function(require,module,exports){
exports.getTypeInfo = function(ctor, key, ignoreSignature) {
	if (typeof(ctor) !== 'function') {
		var message = ctor && ctor.constructor
			? 'instance of ' + ctor.constructor.name
			: (!ctor ? 'null' : typeof(ctor));
		throw new Error('Constructor must be a function, got ' + message);
	}

	var docCommentRegex = [
		//normal function or es6 class method
		/^(?:function\s+)?(?:(\w+))?\s*\(([^)]*)\)\s*\{/,
		//class with constructor
		/^class(?:[\s+](\w+))?[\s\S]+?constructor\s*\(([^)]*)\)\s*\{/,
		//class without constructor
		/^class(?:[\s+](\w+))?/,
		//fat arrow functions (always anonymous, so first group capture must be empty)
		/^()\(?([^)]*)\)?\s*=>\s*\{/
	];

	var data;

	for (var i = 0; i < docCommentRegex.length; i++) {
		data = docCommentRegex[i].exec(ctor.toString());
		if (data) {
			break;
		}
	}

	if (!data) {
		throw new Error(
			'Unable to parse function definition: ' + ctor.toString() + '. If ' +
			'this is a valid constructor, please open an issue with the developers.'
		);
	}

	var typeName = key || data[1],
		signature = (data[2] || '').trim();
	if (!typeName) {
		throw new Error('A resolution key must be given if a named function is not');
	}

	var typeInfo = {
		args: [],
		ctor: ctor,
		name: typeName
	};

	if (!ignoreSignature && signature) {
		signature.split(',').forEach(function(param, i) {
			var paramTrimmed = param.trim();
			//ferret out the type of each argument based on inline jsdoc:
			//https://code.google.com/p/jsdoc-toolkit/wiki/InlineDocs
			var data = /^\/\*\*\s*([^*\s]+?)\s*\*+\/\s*(\w+)\s*$/.exec(paramTrimmed);
			if (!data) {
				throw new Error(
					'Unable to determine type of parameter at position ' + (i + 1) +
					' ("' + paramTrimmed + '") for type "' + typeName + '"; are you ' +
					'missing a doc comment?'
				);
			}

			typeInfo.args.push({
				position: i,
				type: data[1],
				name: data[2]
			});
		});
	}

	return typeInfo;
};

},{}]},{},[5])(5)
});