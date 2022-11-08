import { ReadableStream } from "../runtime/runtime.js";
import { Pointer } from "../runtime/pointers.js";
import { datex_scope } from "../utils/global_types.js";
import { TypedArray } from "../utils/global_values.js";
import { StreamConsumer, ValueConsumer } from "./abstract_types.js";

// <Stream> is stream sink and readable stream at the same time
export class Stream<T = ArrayBuffer> implements StreamConsumer<T> {


    controller: ReadableStreamDefaultController

    readable_stream: ReadableStream<T> 

    constructor(readable_stream?:ReadableStream<T>) {
        this.readable_stream = readable_stream ?? new ReadableStream({
            start: controller => this.controller = controller
        });
    }

    started_ptr_stream = false

    write(chunk: T, scope?: datex_scope) {

        // convert buffers
        if (chunk instanceof TypedArray) chunk = (<any>chunk).buffer;

        if (!this.started_ptr_stream && !scope) {  // no scope -> assume called from JS, not DATEX
            this.started_ptr_stream = true;
            const ptr = Pointer.getByValue(this);
            if (ptr instanceof Pointer) {
                console.log("Start stream out for " + ptr.idString());
                ptr.startStreamOut(); // stream to all subscribers or origin
            }
        }

        this.controller.enqueue(chunk);
    }

    async pipe(in_stream:Stream<T>, scope?: datex_scope) {
        const reader = in_stream.getReader();
        let next:ReadableStreamReadResult<T>;
        while (true) {
            next = await reader.read()
            if (next.done) break;
            this.write(next.value, scope);
        }
    }

    close() {
        this.controller.close()
    }

    getReader() {
        // split in two readable streams
        let streams = this.readable_stream.tee()
        this.readable_stream = streams[1];
        return streams[0].getReader()
    }

}
