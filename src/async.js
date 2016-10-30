var noError = null;

function map(arr, iterator, series, callback) {
	var mapped = new Array(arr.length);
	var finished = 0;
	var expected = arr.length;
	var error = noError;

	if (!arr.length) {
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
		} else if (series) {
			setImmediate(function() {
				run(index + 1);
			}, 1);
		}
	}

	function run(index) {
		var item = arr[index];
		if (!item) {
			finish(index);
			return;
		}

		iterator(item, finish.bind(null, index));
	}

	if (series) {
		run(0);
	} else {
		arr.forEach(function(value, i) {
			run(i);
		});
	}
}

module.exports = {
	each: function(arr, iterator, callback) {
		map(arr, iterator, false, function(err) {
			callback(err);
		});
	},

	map: function(arr, iterator, callback) {
		map(arr, iterator, false, callback);
	},

	mapSeries: function(arr, iterator, callback) {
		map(arr, iterator, true, callback);
	},

	series: function(thunks, callback) {
		function iterator(thunk, next) {
			thunk(next);
		}

		map(thunks, iterator, true, function(err) {
			callback(err);
		});
	}
};
