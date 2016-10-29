var noError = null;

module.exports = {
	each: function(arr, iterator, callback) {
		var finished = 0;
		var expected = arr.length;
		var error = noError;

		if (!expected) {
			callback(noError);
			return;
		}

		function finish(err) {
			finished++;
			if (err) {
				error = error || err;
			}

			if (finished >= expected) {
				callback(error);
			}
		}

		arr.forEach(function(value) {
			iterator(value, finish);
		});
	},

	map: function(arr, iterator, callback) {
		var mapped = new Array(arr.length);
		var error = noError;
		var finished = 0;
		var expected = arr.length;

		if (!expected) {
			callback(noError, mapped);
			return;
		}

		function finish(index, err, result) {
			finished++;

			if (err) {
				error = error || err;
			} else {
				mapped[index] = result;
			}

			if (expected === finished) {
				callback(error, error ? null : mapped);
			}
		}

		arr.forEach(function(item, index) {
			iterator(item, finish.bind(null, index));
		});
	},

	mapSeries: function(arr, iterator, callback) {
		var mapped = new Array(arr.length);

		if (!arr.length) {
			callback(noError, mapped);
			return;
		}

		function run(index) {
			var item = arr[index];
			if (!item) {
				callback(noError, mapped);
				return;
			}

			iterator(item, function(err, result) {
				if (err) {
					callback(err);
					return;
				}

				mapped[index] = result;

				setImmediate(function() {
					run(index + 1);
				}, 1);
			});
		}

		run(0);
	},

	series: function(thunks, callback) {
		if (!thunks.length) {
			callback(noError);
			return;
		}

		function run(index) {
			var thunk = thunks[index];
			if (!thunk) {
				callback(noError);
				return;
			}

			thunk(function(err) {
				if (err) {
					callback(err);
					return;
				}

				setImmediate(function() {
					run(index + 1);
				}, 1);
			});
		}

		run(0);
	}
};
