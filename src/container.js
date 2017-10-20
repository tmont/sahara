const Graph = require('tarjan-graph');
const ObjectBuilder = require('./object-builder');
const lifetimes = require('./lifetime');
const EventEmitter = require('./event-emitter');
const utils = require('./util');

function createUnregisteredError(key, context) {
	let message = `Nothing with key "${key}" is registered in the container`;
	if (context && context.history.length) {
		message += '; error occurred while resolving ';
		message += context.history.concat([{ name: key }])
			.map(registration => `"${registration.name}"`)
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
	return instance && instance.constructor && instance.constructor.name;
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

class Container extends EventEmitter {
	constructor(parent) {
		super();
		this.parent = parent || null;
		this.registrations = {};
		this.graph = new Graph();
		this.builder = new ObjectBuilder(this.resolve.bind(this), this.resolveSync.bind(this));
		this.registerInstance(this);
	}

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
	registerType(ctor, key, lifetime, injections) {
		const options = resolveSignatureToOptions(arguments);
		const typeInfo = utils.getTypeInfo(ctor, options.key);
		const typeName = typeInfo.name;

		this.emit('registering', typeName, 'type');
		this.registrations[typeName] = new TypeRegistration(
			typeName,
			options.lifetime,
			options.injections,
			typeInfo
		);

		try {
			this.graph.addAndVerify(typeName, typeInfo.args.map(info => info.type));
		} catch (e) {
			throw new Error(`${typeName}'s dependencies create a cycle: ${e.message}`);
		}

		return this;
	}

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
	registerInstance(instance, key, lifetime, injections) {
		const options = resolveSignatureToOptions(arguments);
		options.key = options.key || getKeyFromInstance(instance);
		this.emit('registering', options.key, 'instance');
		this.registrations[options.key] = new InstanceRegistration(
			options.key,
			options.lifetime,
			options.injections,
			instance
		);

		return this;
	}

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
	registerFactory(factory, key, lifetime, injections) {
		const options = resolveSignatureToOptions(arguments);
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
	 * @param {Object} [context] Resolver context used internally
	 * @return {*} The resolved object
	 */
	resolveSync(key, context) {
		if (typeof(key) === 'function') {
			key = getKeyFromCtor(key);
		}
		context = context || createResolverContext();

		const registration = this.registrations[key];
		this.emit('resolving', key);
		if (!registration) {
			throw createUnregisteredError(key, context);
		}

		context.history.push(registration);

		const existing = registration.lifetime.fetch();
		if (existing) {
			this.emit('resolved', key, existing);
			return existing;
		}

		let instance;
		if (registration instanceof InstanceRegistration) {
			instance = registration.instance;
		} else if (registration instanceof TypeRegistration) {
			instance = this.builder.newInstanceSync(registration.typeInfo, context);
		} else if (registration instanceof FactoryRegistration) {
			instance = registration.factory(this);
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

		const registration = this.registrations[key];
		this.emit('resolving', key);
		if (!registration) {
			return Promise.reject(createUnregisteredError(key, context));
		}

		context.history.push(registration);

		const existing = registration.lifetime.fetch();
		if (existing) {
			this.emit('resolved', key, existing);
			return existing;
		}

		try {
			let instance;
			if (registration instanceof InstanceRegistration) {
				instance = registration.instance;
			} else if (registration instanceof TypeRegistration) {
				instance = await this.builder.newInstance(registration.typeInfo, context);
			} else if (registration instanceof FactoryRegistration) {
				instance = await registration.factory(this);
			}

			context.history.pop();

			await this.inject(instance, key);
			registration.lifetime.store(instance);
			this.emit('resolved', key, instance);
			return instance;
		} catch (e) {
			return Promise.reject(e)
		}
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
			return Promise.reject(createUnregisteredError(key));
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
			throw createUnregisteredError(key);
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
