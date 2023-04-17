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

try{
    await mongoClient.connect();
    db = mongoClient.db("batepapouol");
    console.log(`conectou no banco`)
}
catch(error){
    console.log(error);
    console.log("não conectou no banco de dados");
}

// SCHEMAS
const participantsSchema = joi.object({
    name: joi.string().required().min(1)
})
//

app.post("/participants", async (req,res) => {
    const { name } = req.body;
    const { error } = participantsSchema.validate({ name });

    if(error){
        console.log("nao passou na validacao")
        return res.sendStatus(422)
    }
    
    try{
        let participantsCheck = await db.collection("participants").findOne({ name });
        if(participantsCheck){
            console.log("usuario já existe")
            res.sendStatus(409);
            return;
        }
        let date = Date.now();
        await db.collection("participants").insertOne({name: name , lastStatus: date});
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
    catch(error){
        console.log(error)
        res.status(500).send("Houve um erro")
        return;
    }
});

app.get("/participants", async (req,res) => {
    let listaParticipants = [];
    try{
        listaParticipants = await db.collection("participants").find().toArray();
        res.send(listaParticipants);
    }
    catch{
        console.log("lista de participantes vazia");
        res.send(listaParticipants);
    }
});

const port = 5000;
app.listen(port, () => console.log('server ligado'));