module.exports = function(obj) {
	var original = obj || {};
	var others = [].slice.call(arguments, 1);

	for (var i = 0; i < others.length; i++) {
		var other = others[i];
		for (var key in other) {
			if (!other.hasOwnProperty(key)) {
				continue;
			}

			original[key] = other[key];
		}
	}


	return original;
};
