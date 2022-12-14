"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const main_1 = __importDefault(require("./main"));
const worker_threads_1 = require("worker_threads");
if (worker_threads_1.isMainThread) {
    const pit = new main_1.default('./demo.js', 7);
    let lastUtilisation = 0.0;
    function logUtilisation() {
        let u = pit.utilisation;
        if (u == lastUtilisation)
            return;
        lastUtilisation = u;
        // Note that utilisation is 1-(freeWorkerCount/maxWorkers), NOT 1-(freeWorkerCount/workerCount).
        console.log(`%${Math.round(u * 10000) / 100}, ${(pit.workerCount - pit.freeWorkerCount)}/${pit.workerCount} workers in use.`);
    }
    pit.events.on('workDispatched', logUtilisation);
    pit.events.on('workComplete', logUtilisation);
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
