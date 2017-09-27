const async = require('./async');
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

	invokeCtor(ctor, handlerConfigs, args) {
		return new (Function.prototype.bind.apply(ctor, [null].concat(args)))();
	}

	newInstanceSync(typeInfo, handlerConfigs, context) {
		this.emit('building', typeInfo);
		const args = getParams(typeInfo).map(function(typeData) {
			return this.resolverSync(typeData.type, context);
		}.bind(this));

		const instance = this.invokeCtor(typeInfo.ctor, handlerConfigs, args);
		this.emit('built', typeInfo, instance);
		return instance;
	}

	newInstance(typeInfo, handlerConfigs, context, callback) {
		this.emit('building', typeInfo);
		async.mapSeries(getParams(typeInfo), (typeData, next) => {
			this.resolver(typeData.type, context, next);
		}, (err, args) => {
			if (err) {
				callback(err);
				return;
			}

			const instance = this.invokeCtor(typeInfo.ctor, handlerConfigs, args);
			this.emit('built', typeInfo, instance);
			callback(null, instance);
		});
	}
}

module.exports = ObjectBuilder;
