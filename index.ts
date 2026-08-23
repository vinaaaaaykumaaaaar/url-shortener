console.log("Hello via Bun!");

interface output {
    data: string;
    status: number;
}

function demo(input: string): output {
    return {
        data: input,
        status: 200
    }
}

function run(input: string): any {
    return demo(input);
}

console.log(run("vinay"));