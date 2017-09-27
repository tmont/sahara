class EventEmitter {
	constructor() {
		this.events = {};
	}

	listeners(name) {
		if (!this.events[name]) {
			this.events[name] = [];
		}

		return this.events[name];
	}

	on(name, listener) {
		this.listeners(name).push(listener);
	}

	off(name, listener) {
		const listeners = this.listeners(name);
		const index = listeners.indexOf(listener);
		if (index !== -1) {
			listeners.splice(index, 1);
		}
	}

	emit(name, ...args) {
		this.listeners(name).forEach((listener) => {
			listener.apply(this, args);
		});
	}
}

module.exports = EventEmitter;
