const express = require("express");
const fetch = require("node-fetch");
const { spawn, fork } = require("child_process");
const { Worker } = require("worker_threads");
const app = express();

app.get("/getfibonacci", (req, res) => {
  const startTime = new Date();
  const result = fibonacci(parseInt(req.query.number)); //parseInt is for converting string to number
  const endTime = new Date();
  res.json({
    number: parseInt(req.query.number),
    fibonacci: result,
    time: endTime.getTime() - startTime.getTime() + "ms",
  });
});

app.get("/isprime", async (req, res) => {
  const startTime = new Date();
  const result = await isPrime(parseInt(req.query.number)); //parseInt is for converting string to number
  const endTime = new Date();
  res.json({
    number: parseInt(req.query.number),
    isprime: result,
    time: endTime.getTime() - startTime.getTime() + "ms",
  });
});

app.get("/isprime1", async (req, res) => {
  const childProcess = fork("./forkedchild.js");
  childProcess.send({ number: parseInt(req.query.number) });
  const startTime = new Date();
  childProcess.on("message", (message) => {
    //on("message") method is used to listen for messages send by the child process
    const endTime = new Date();
    res.json({
      ...message,
      time: endTime.getTime() - startTime.getTime() + "ms",
    });
  });
});

app.get("/sumofprimeswiththreads", async (req, res) => {
  const startTime = new Date().getTime()
  const sum = await divideWorkAndGetSum()
    .then(
      (
        values //values is an array containing all the resolved values
      ) => values.reduce((accumulator, part) => accumulator + part.result, 0) //reduce is used to sum all the results from the workers
    )
    .then(finalAnswer => finalAnswer)
    .catch(err=>console.error(err))

  const endTime = new Date().getTime()
  res.json({
    number: 600000,
    sum: sum,
    timeTaken: (endTime - startTime) / 1000 + " seconds",
  })
})

app.get("/calltoslowserver", async (req, res) => {
  const result = await fetch("http://localhost:5000/slowrequest"); //fetch returns a promise
  const resJson = await result.json();
  res.json(resJson);
});

app.get("/testrequest", (req, res) => {
  res.send("I am unblocked now");
});

app.get("/ls", (req, res) => {
  const ls = spawn("ls", ["-lash", req.query.directory]);
  ls.stdout.on("data", (data) => {
    //Pipe (connection) between stdin,stdout,stderr are established between the parent
    //node.js process and spawned subprocess and we can listen the data event on the stdout

    res.write(data.toString()); //date would be coming as streams(chunks of data)
    // since res is a writable stream,we are writing to it
  });
  ls.on("error", () => {
    res.end();
  });
  ls.on("close", (code) => {
    console.log(`child process exited with code ${code}`);
    res.end(); //finally all the written streams are send back when the subprocess exit
  });
});

const fibonacci = (n) => {
  if (n <= 1) {
    return 1;
  }

  return fibonacci(n - 1) + fibonacci(n - 2);
};

const isPrime = (number) => {
  return new Promise((resolve) => {
    let isPrime = true;
    for (let i = 3; i < number; i++) {
      if (number % i === 0) {
        isPrime = false;
        break;
      }
    }

    resolve(isPrime);
  });
};

function runWorker(workerData) {
  return new Promise((resolve, reject) => {
    //first argument is filename of the worker
    const worker = new Worker("./sumOfPrimesWorker.js", {
      workerData,
    })
    worker.on("message", resolve) //This promise is gonna resolve when messages comes back from the worker thread
    worker.on("error", reject)
    worker.on("exit", code => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`))
      }
    })
  })
}

function divideWorkAndGetSum() {
  // we are hardcoding the value 600000 for simplicity and dividing it
  //into 4 equal parts

  const start1 = 2
  const end1 = 150000
  const start2 = 150001
  const end2 = 300000
  const start3 = 300001
  const end3 = 450000
  const start4 = 450001
  const end4 = 600000
  //allocating each worker seperate parts
  const worker1 = runWorker({ start: start1, end: end1 })
  const worker2 = runWorker({ start: start2, end: end2 })
  const worker3 = runWorker({ start: start3, end: end3 })
  const worker4 = runWorker({ start: start4, end: end4 })
  //Promise.all resolve only when all the promises inside the array has resolved
  return Promise.all([worker1, worker2, worker3, worker4])
}

app.listen(3000, () => console.log("listening on port 3000"));
