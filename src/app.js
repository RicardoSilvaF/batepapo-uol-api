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

    // VALIDACAO DO USUARIO E DA MENSAGEM
    if(!user){
        console.log("sem usuario");
        res.sendStatus(422);
        return;
    }
    const userCheck = await db.collection("participants").findOne({ name: user});
    if(userCheck === null){
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
    // VALIDACAO DO USUARIO E DA MENSAGEM

    message.from = user;
    message.time = dayjs(Date.now()).format("HH:mm:ss");
    console.log(message.from);
    console.log(message.time);
    await db.collection("messages").insertOne({message});

    res.sendStatus(201);
})
// MESSAGES

const port = 5000;
app.listen(port, () => console.log('server ligado'));