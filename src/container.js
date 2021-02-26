const Graph = require('tarjan-graph');
const ObjectBuilder = require('./object-builder');
const lifetimes = require('./lifetime');
const EventEmitter = require('./event-emitter');
const utils = require('./util');

const getHistoryString = (context, current) => {
	const history = context.history.concat([]);
	if (current) {
		history.push({ name: current });
	}

	return history.map(registration => `"${registration.name}"`).join(' -> ');
}

function getUnregisteredErrorMessage(key, context) {
	let message = `Nothing with key "${key}" is registered in the container`;
	if (context && context.history.length) {
		message += '; error occurred while resolving ' + getHistoryString(context, key);
	}

	if (key.startsWith(utils.argPrefix)) {
		message += `; you may be missing a ` +
			`doc comment or a call to registerAliasAsArg`;
	}

	return message;
}

function createResolverContext() {
	return {
		history: []
	};
}

function resolveSignatureToOptions(args) {
	if (args.length === 0) {
		return {};
	}

	//just a regular options object (making sure to check for null!)
	if (args[0] && typeof(args[0]) === 'object') {
		return args[0];
	}

	const options = {};
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
	return instance && instance.constructor && getKeyFromCtor(instance.constructor);
}

class Registration {
	constructor(name, lifetime, injections) {
		this.name = name;
		this.lifetime = lifetime || new lifetimes.Transient();
		this.injections = injections || [];
	}
}

class TypeRegistration extends Registration {
	constructor(name, lifetime, injections, typeInfo) {
		super(name, lifetime, injections);
		this.typeInfo = typeInfo;
	}
}

class InstanceRegistration extends Registration {
	constructor(name, lifetime, injections, instance) {
		super(name, lifetime, injections);
		this.instance = instance;
	}
}

class FactoryRegistration extends Registration {
	constructor(name, lifetime, injections, factory) {
		super(name, lifetime, injections);
		this.factory = factory;
	}
}

class DelegateRegistration extends Registration {
	constructor(alias, delegateKey) {
		super(alias);
		this.delegateKey = delegateKey;
	}
}

class Container extends EventEmitter {
	constructor(parent) {
		super();
		this.parent = parent || null;
		this.registrations = {};
		this.graph = new Graph();
		this.builder = new ObjectBuilder(this.resolve.bind(this), this.resolveSync.bind(this));
		this.registerInstance(this);
	}

	addDependencyToGraph(key, dependencies) {
		try {
			this.graph.addAndVerify(key, dependencies);
		} catch (e) {
			throw new Error(`${key}'s dependencies create a cycle: ${e.message}`);
		}
	}

	/**
	 * Registers a type from a constructor
	 */
	registerType(ctor, ...args) {
		const options = resolveSignatureToOptions(args);
		const typeInfo = utils.getTypeInfo(ctor, options.key);
		const key = typeInfo.name;

		this.emit('registering', key, 'type');

		this.registrations[key] = new TypeRegistration(key, options.lifetime, options.injections, typeInfo);
		if (options.argAlias && typeof(options.argAlias) === 'string') {
			this.registerArgAlias(key, options.argAlias);
		}

		this.addDependencyToGraph(key, typeInfo.args.map(info => info.type));

		return this;
	}

	registerTypeAndArgAlias(ctor, key, alias) {
		if (typeof(alias) === 'undefined') {
			alias = key;
			key = null;
		}

		this.registerType(ctor, {
			key,
			argAlias: alias,
		});

		return this;
	}

	registerAlias(key, alias) {
		if (typeof(key) !== 'string') {
			throw new Error('key must be a string');
		}
		if (typeof(alias) !== 'string') {
			throw new Error('alias must be a string');
		}

		// this alias has a dependency on the thing it's aliasing
		this.graph.addAndVerify(alias, [ key ]);

		this.registrations[alias] = new DelegateRegistration(alias, key);
		return this;
	}

	registerArgAlias(key, alias) {
		return this.registerAlias(key, utils.argPrefix + alias);
	}

	/**
	 * Registers a specific object instance
	 */
	registerInstance(instance, ...args) {
		const options = resolveSignatureToOptions(args);
		options.key = options.key || getKeyFromInstance(instance);

		this.emit('registering', options.key, 'instance');

		this.registrations[options.key] = new InstanceRegistration(
			options.key,
			options.lifetime,
			options.injections,
			instance,
		);

		if (options.argAlias && typeof(options.argAlias) === 'string') {
			this.registerArgAlias(options.key, options.argAlias);
		}

		return this;
	}

	registerInstanceAndArgAlias(instance, key, alias) {
		if (typeof(alias) === 'undefined') {
			alias = key;
			key = null;
		}

		this.registerInstance(instance, {
			key,
			argAlias: alias,
		});

		return this;
	}

	/**
	 * Registers a factory function for a type that will create
	 * the object
	 */
	registerFactory(factory, ...args) {
		const options = resolveSignatureToOptions(args);
		if (!options.key) {
			throw new Error('"options.key" must be passed to registerFactory()');
		}

		this.emit('registering', options.key, 'factory');

		this.registrations[options.key] = new FactoryRegistration(
			options.key,
			options.lifetime,
			options.injections,
			factory,
		);

		if (options.argAlias && typeof(options.argAlias) === 'string') {
			this.registerArgAlias(options.key, options.argAlias);
		}

		return this;
	}

	registerFactoryAndArgAlias(factory, key, alias) {
		this.registerFactory(factory, {
			key,
			argAlias: alias,
		});

		return this;
	}

	/**
	 * Determines if something is registered with the given key
	 * @param {String|Function} key The resolution key or constructor
	 * @return {Boolean}
	 */
	isRegistered(key) {
		if (typeof(key) === 'function') {
			key = getKeyFromCtor(key);
		}

		return !!this.registrations[key];
	}

	/**
	 * Resolve a type to an instance synchronously
	 *
	 * @param {String|Function} key The resolution key or constructor to resolve
	 * @param {{ history: [] }} [context] Resolver context used internally
	 * @return {*} The resolved object
	 */
	resolveSync(key, context) {
		if (typeof(key) === 'function') {
			key = getKeyFromCtor(key);
		}
		context = context || createResolverContext();

		let registration = this.registrations[key];
		this.emit('resolving', key);
		if (!registration) {
			throw new Error(getUnregisteredErrorMessage(key, context));
		}

		const existing = registration.lifetime.fetch();
		if (existing) {
			this.emit('resolved', key, existing);
			return existing;
		}

		context.history.push(registration);

		let instance;
		if (registration instanceof InstanceRegistration) {
			instance = registration.instance;
		} else if (registration instanceof TypeRegistration) {
			instance = this.builder.newInstanceSync(registration.typeInfo, context);
		} else if (registration instanceof FactoryRegistration) {
			instance = registration.factory(this);
		} else if (registration instanceof DelegateRegistration) {
			instance = this.resolveSync(registration.delegateKey, context);
		}

		context.history.pop();

		this.injectSync(instance, key);
		registration.lifetime.store(instance);
		this.emit('resolved', key, instance);
		return instance;
	}

	/**
	 * Resolve a type to an instance asynchronously
	 *
	 * @param {String|Function} key The resolution key or constructor to resolve
	 * @param {Object} [context] Resolver context used internally
	 * @return {Promise} The resolved object
	 */
	async resolve(key, context) {
		if (typeof(key) === 'function') {
			key = getKeyFromCtor(key);
		}
		context = context || createResolverContext();

		let registration = this.registrations[key];
		this.emit('resolving', key);
		if (!registration) {
			throw new Error(getUnregisteredErrorMessage(key, context));
		}

		const existing = registration.lifetime.fetch();
		if (existing) {
			this.emit('resolved', key, existing);
			return existing;
		}

		context.history.push(registration);

		let instance;

		if (registration instanceof InstanceRegistration) {
			instance = registration.instance;
		} else if (registration instanceof TypeRegistration) {
			instance = await this.builder.newInstance(registration.typeInfo, context);
		} else if (registration instanceof FactoryRegistration) {
			instance = await registration.factory(this);
		} else if (registration instanceof DelegateRegistration) {
			instance = await this.resolve(registration.delegateKey, context);
		}

		context.history.pop();

		await this.inject(instance, key);
		registration.lifetime.store(instance);
		this.emit('resolved', key, instance);
		return instance;
	}

	/**
	 * Same as resolve(), but won't ever reject
	 * @param key
	 * @return {Promise} The resolved object, or undefined if the key doesn't exist
	 */
	async tryResolve(key) {
		try {
			return await this.resolve(key);
		} catch (e) {
			return undefined;
		}
	}

	/**
	 * Same as resolveSync(), but won't ever throw
	 * @param key
	 * @return {*} The resolved object, or undefined if the key doesn't exist
	 */
	tryResolveSync(key) {
		try {
			return this.resolveSync(key);
		} catch (e) {
			return undefined;
		}
	}

	/**
	 * Performs injection on an object asynchronously
	 *
	 * @param {*} instance The object to perform injection on
	 * @param {String} [key] The resolution key; defaults to instance.constructor.name
	 * @returns {Promise}
	 */
	async inject(instance, key) {
		key = key || getKeyFromInstance(instance);
		const registration = this.registrations[key];
		if (!registration) {
			return Promise.reject(new Error(getUnregisteredErrorMessage(key)));
		}

		return Promise.all(registration.injections.map(injection => injection.inject(instance, this)));
	}

	/**
	 * Performs injection on an object synchronously
	 *
	 * @param {*} instance The object to perform injection on
	 * @param {String} [key] The resolution key; defaults to instance.constructor.name
	 */
	injectSync(instance, key) {
		key = key || getKeyFromInstance(instance);
		const registration = this.registrations[key];
		if (!registration) {
			throw new Error(getUnregisteredErrorMessage(key));
		}

		registration.injections.map((injection) => {
			injection.injectSync(instance, this);
		});
	}

	/**
	 * Creates a clone of the container in its current state
	 *
	 * @param {Boolean} [withEvents]
	 * @returns {Container}
	 */
	createChildContainer(withEvents) {
		const childContainer = new this.constructor(this);

		Object.keys(this.registrations).forEach((key) => {
			childContainer.registrations[key] = this.registrations[key];
		});
		childContainer.registerInstance(childContainer);

		childContainer.graph = this.graph.clone();

		if (withEvents) {
			[ 'registering', 'resolving', 'resolved' ].forEach((event) => {
				this.listeners(event).forEach((listener) => {
					childContainer.on(event, listener);
				});
			});

			[ 'building', 'built' ].forEach((event) => {
				this.builder.listeners(event).forEach((listener) => {
					childContainer.builder.on(event, listener);
				});
			});
		}

		return childContainer;
	}
}

module.exports = Container;
