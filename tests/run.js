var semver = require('semver'),
	path = require('path'),
	fs = require('fs');

var es5Dir = path.join(__dirname, 'es5'),
	es6Dir = path.join(__dirname, 'es6');

fs.readdirSync(es5Dir).forEach(function(file) {
	require(path.join(es5Dir, file));
});

if (semver.gte(process.versions.node, '4.0.0')) {
	fs.readdirSync(es6Dir).forEach(function(file) {
		require(path.join(es6Dir, file));
	});
}
