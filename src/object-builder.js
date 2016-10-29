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
