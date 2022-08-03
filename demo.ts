import WorkerPit from './main';
import { isMainThread, parentPort } from 'worker_threads';

if (isMainThread) {

    const pit: WorkerPit<number, number> = new WorkerPit('./demo.js', 7);

    let lastUtilisation: number = 0.0;
    function logUtilisation() {
        let u = pit.utilisation;
        if (u == lastUtilisation) return;
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

} else {

    function workerFunction(data: number): any {
        // Expensive calculation
        let acc = 0;
        for (let i = 0; i < data ** data; i += 1) {
            acc += 1;
        }
        return acc
    }

    parentPort?.on('message', (data) => parentPort?.postMessage(workerFunction(data)));
}