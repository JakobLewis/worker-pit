"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const main_1 = __importDefault(require("./main"));
const worker_threads_1 = require("worker_threads");
if (worker_threads_1.isMainThread) {
    const pit = new main_1.default('./demo.js', 10);
    // Shut the pit down once it has completed all work
    pit.events.on('empty', () => pit.minWorkers = 0);
    // Simulate two workloads.
    for (let i = 1; i < 10; i += 1) {
        (async () => {
            console.log('1. Work result:', await pit.throwWork(i));
        })();
    }
    for (let i = 1; i < 10; i += 1) {
        (async () => {
            setTimeout(async () => console.log('2. Work result:', await pit.throwWork(i)), 3000);
        })();
    }
}
else {
    function workerFunction(data) {
        // Expensive calculation
        let acc = 0;
        for (let i = 0; i < data ** data; i += 1) {
            acc += 1;
        }
        return acc;
    }
    worker_threads_1.parentPort?.on('message', (data) => worker_threads_1.parentPort?.postMessage(workerFunction(data)));
}
