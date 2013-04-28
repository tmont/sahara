var async = require('async');

function invokeCtor(ctor, args) {
	var instance = Object.create(ctor.prototype);
	ctor.apply(instance, args);
	return instance;
}

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
	this.resolver = resolver;
	this.resolverSync = resolverSync;
}

ObjectBuilder.prototype = {
	newInstanceSync: function(typeInfo) {
		var args = getParams(typeInfo).map(function(typeData) {
			return this.resolverSync(typeData.type);
		}.bind(this));

		return invokeCtor(typeInfo.ctor, args);
	},

	newInstance: function(typeInfo, callback) {
		var self = this;
		async.map(getParams(typeInfo), function(typeData, next) {
			self.resolver(typeData.type, function(err, param) {
				process.nextTick(function() {
					next(err, param);
				});
			});
		}, function(err, args) {
			if (err) {
				callback(err);
				return;
			}

			callback(null, invokeCtor(typeInfo.ctor, args));
		});
	}
};

module.exports = ObjectBuilder;