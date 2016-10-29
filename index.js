var injection = require('./src/injection'),
	lifetime = require('./src/lifetime');

exports.Container = require('./src/container');
exports.interception = {
	Container: require('./src/interception/container')
};
exports.inject = {
	propertyValue: function(name, value) {
		return new injection.PropertyValue(name, value);
	},
	property: function(name, key) {
		return new injection.Property(name, key);
	},
	method: function(name, args) {
		return new injection.Method(name, args);
	}
};
exports.lifetime = {
	transient: function() {
		return new lifetime.Transient();
	},
	memory: function() {
		return new lifetime.Memory();
	}
};
