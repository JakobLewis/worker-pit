import WorkerPit from './main';
import { isMainThread, parentPort } from 'worker_threads';

if (isMainThread) {
    const pit: WorkerPit<number, number> = new WorkerPit('./demo.js', 10);

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