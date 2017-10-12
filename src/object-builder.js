const EventEmitter = require('./event-emitter');

function getParams(typeInfo) {
	const params = typeInfo.args;
	params.sort(function(a, b) {
		if (a.position === b.position) {
			return 0;
		}

		return a.position < b.position ? -1 : 1;
	});

	return params;
}

class ObjectBuilder extends EventEmitter {
	constructor(resolver, resolverSync) {
		super();
		this.resolver = resolver;
		this.resolverSync = resolverSync;
	}

	invokeCtor(ctor, args) {
		return new ctor(...args);
	}

	newInstanceSync(typeInfo, context) {
		this.emit('building', typeInfo);
		const args = getParams(typeInfo).map((typeData) => {
			return this.resolverSync(typeData.type, context);
		});

		const instance = this.invokeCtor(typeInfo.ctor, args);
		this.emit('built', typeInfo, instance);
		return instance;
	}

	async newInstance(typeInfo, context) {
		this.emit('building', typeInfo);

		const args = [];
		const params = getParams(typeInfo);

		// NOTE: these must be resolved in order
		for (const param of params) {
			args.push(await this.resolver(param.type, context));
		}

		try {
			const instance = this.invokeCtor(typeInfo.ctor, args);
			this.emit('built', typeInfo, instance);
			return instance;
		} catch (e) {
			return Promise.reject(e);
		}
	}
}

module.exports = ObjectBuilder;
