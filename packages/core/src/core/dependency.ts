/* eslint-disable @typescript-eslint/no-unsafe-function-type */
export class Dependency {
    [x: string]: any;
    private subscribers: Set<Function>;

    constructor() {
        this.subscribers = new Set();
    }

    depend(callback: Function | null) {
        if (callback) {
            this.subscribers.add(callback);
        }
    }

    notify() {
        this.subscribers.forEach((subscriber) => subscriber());
    }

    remove(callback: Function) {
        this.subscribers.delete(callback);
    }

    clear() {
        this.subscribers.clear();
    }

    get getSubscribers() {
        return this.subscribers;
    }
}
