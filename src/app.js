import express from "express";
import joi from "joi";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

try {
    await mongoClient.connect();
    db = mongoClient.db("batepapouol");
    console.log(`conectou no banco`)
}
catch (error) {
    console.log(error);
    console.log("não conectou no banco de dados");
}

// SCHEMAS
const participantsSchema = joi.object({
    name: joi.string().required().min(1)
})
const messagesSchema = joi.object({
    to: joi.string().required().min(1),
    text: joi.string().required().min(1),
    type: joi.string().required().valid('message', 'private_message')
})
// SCHEMAS

// PARTICIPANTS
app.post("/participants", async (req, res) => {
    const { name } = req.body;
    const { error } = participantsSchema.validate({ name });

    if (error) {
        console.log("nao passou na validacao")
        return res.sendStatus(422)
    }

    try {
        let participantsCheck = await db.collection("participants").findOne({ name });
        if (participantsCheck) {
            console.log("usuario já existe")
            res.sendStatus(409);
            return;
        }
        let date = Date.now();
        await db.collection("participants").insertOne({ name: name, lastStatus: date });
        await db.collection("messages").insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs(date).format("HH:mm:ss")
        });
        res.status(201).send("cadastrado com sucesso")
        return;
    }
    catch (error) {
        console.log(error)
        res.status(500).send("Houve um erro")
        return;
    }
});

app.get("/participants", async (req, res) => {
    let listaParticipants = [];
    try {
        listaParticipants = await db.collection("participants").find().toArray();
        res.send(listaParticipants);
    }
    catch {
        console.log("lista de participantes vazia");
        res.send(listaParticipants);
    }
});
// PARTICIPANTS

// MESSAGES
app.post("/messages", async (req, res) => {

    let { to, text, type } = req.body;
    let { user } = req.headers;
    const message = {
        to,
        text,
        type
    }

    // USER AND MESSAGE VALIDATION
    if (!user) {
        console.log("sem usuario");
        res.sendStatus(422);
        return;
    }
    const userCheck = await db.collection("participants").findOne({ name: user });
    if (userCheck === null) {
        console.log("usuario inexistente");
        res.sendStatus(422);
        return;
    }
    const { error } = messagesSchema.validate(message)
    if (error) {
        console.log(error.message);
        res.sendStatus(422);
        return;
    }
    // USER AND MESSAGE VALIDATION

    message.from = user;
    message.time = dayjs(Date.now()).format("HH:mm:ss");
    await db.collection("messages").insertOne({
        from: message.from,
        to: message.to,
        text: message.text,
        type: message.type,
        time: message.time
    });

    res.sendStatus(201);
})

app.get("/messages", async (req, res) => {
    let { user } = req.headers;
    let { limit } = req.query;

    // check: limit=0,limit<0,limit not a number; and permits limit=undefined or limit= empty string
    if ((isNaN(limit) || limit <= 0) && limit != undefined && limit != "") {
        res.sendStatus(422);
        return;
    }
    let messageList = await db.collection("messages").find({ $or: [{ type: "message" }, { to: "Todos" }, { from: user }, { to: user }] }).toArray()
    if (limit) {
        res.send(messageList.slice(-limit));
        return;
    }
    else {
        res.send(messageList);
        return;
    }
})
// MESSAGES

// STATUS
app.post("/status", async (req, res) => {
    const { user } = req.headers;
    try {
        if (!user) {
            res.sendStatus(404);
            return;
        }
        const statusCheckUser = await db.collection("participants").findOne({ name: user });
        if (statusCheckUser === null) {
            console.log('user n existe')
            res.sendStatus(404);
            return;
        }
        else {
            await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } })
        }
        res.sendStatus(200);
    }
    catch (error) {
        res.status(500).send(error.message);
    }
})
// STATUS

// INACTIVE REMOVER
setInterval(async () => {
    let date = Date.now();
    let afklimit = 10000; // 10 seconds
    try {
        let afks = await db.collection("participants").find({ lastStatus: { $lt: date - afklimit } }).toArray();
        await db.collection("participants").deleteMany({lastStatus: {$lt: date - afklimit}});
        if (afks.lenght == 0) {
            return;
        }
        else {
            const exitMessages = afks.map((user) => {
                return {
                    from: user.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs().format('HH:mm:ss')
                }
            })
            await db.collection("messages").insertMany(exitMessages);
            
        }
    }
    catch (error) {
        return error;
    }
}, 15000);
// INACTIVE REMOVER

const port = 5000;
app.listen(port, () => console.log('server ligado'));