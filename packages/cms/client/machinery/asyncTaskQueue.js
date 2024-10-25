/**
 * @template T
 * @param {{
*   processTask(task: T): Promise<void>
*   onError(e: Error): void
* }} params
*/
export function createAsyncTaskQueue({ processTask, onError }) {
 /** @type {Array<T>} */
 const queue = []
 let isStarted = false

 return {
   /** @param {T} task */
   add(task) {
     queue.push(task)
     if (!isStarted) start()
   }
 }

 function start() {
   isStarted = true
   nextTask()
 }

 function stop() {
   isStarted = false
 }

 function nextTask() {
   const task = queue.shift()
   const result = processTask(task)

   if (result)
     result.finally(nextTaskOrStop).catch(onError)
   else
     nextTaskOrStop()
 }

 function nextTaskOrStop() {
   if (queue.length)
     nextTask()
   else
     stop()
 }
}
