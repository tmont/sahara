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
