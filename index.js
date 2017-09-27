const exports = require('./src');
exports.interception = {
	Container: require('./src/interception/container')
};

module.exports = exports;
