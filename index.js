const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const req = require("express/lib/request");
const allowedOrigins = [
  "http://localhost:5173",
  "https://todo-client-bef17.web.app",
];
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    // credentials: true,
  })
);
//Socket io
const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);
// const io = new Server(server);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});
io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  socket.on("updateTask", ({ taskId, newCategory }) => {
    console.log("Task updated:", taskId, newCategory);
    io.emit("taskUpdated", { taskId, newCategory });
  });
  socket.on("taskDelete", ({ data }) => {
    const taskId = data.taskId;
    console.log("Task deleted:", taskId);
    io.emit("taskDeleted", { taskId });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
  });
});

const port = process.env.PORT || 5200;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z4uro.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    const taskCollection = client.db("taskManagement").collection("task");
    const userCollection = client.db("taskManagement").collection("users");

    app.get("/tasks", async (req, res) => {
      const result = await taskCollection.find().toArray();
      res.send(result);
    });
    //Task Time and Date Post
    const bdDateTime = () => {
      const now = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Dhaka",
      });
      const [date, time] = now.split(", ");
      return { date, time };
    };
    app.post("/task", async (req, res) => {
      const query = req.body;
      const { date, time } = bdDateTime();
      const newTask = {
        ...query,
        createdDate: date,
        createdTime: time,
      };
      const result = await taskCollection.insertOne(newTask);
      // io.emit("taskAdded", task);
      res.status(201).send(result);
    });

    app.put("/task/:id", async (req, res) => {
      const task = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          title: task.title,
          category: task.category,
          description: task.description,
        },
      };
      const result = await taskCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/task/:id", async (req, res) => {
      const id = req.params.id;
      console.log("todo id", id);
      const { category } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { category },
      };
      const result = await taskCollection.updateOne(filter, updateDoc);
      // io.emit("taskUpdated", { taskId: id, newCategory: category });
      io.emit("taskUpdated", result);
      res.send(result);
    });

    app.delete("/task/:id", async (req, res) => {
      const taskId = req.params.id;
      const query = { _id: new ObjectId(taskId) };
      const result = await taskCollection.deleteOne(query);
      if (result.deletedCount > 0) {
        io.emit("taskDelete", taskId);
        res.send({
          success: true,
          message: "Task deleted successfully",
          taskId,
        });
      } else {
        res.status(404).send({ success: false, message: "Task not found" });
      }

      res.send(result);
    });

    //Users Realted Api

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user Already Exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello ToDo!");
});

// app.listen(port, () => {
//   console.log(`Example app listening at http://localhost:${port}`);
// });

server.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
