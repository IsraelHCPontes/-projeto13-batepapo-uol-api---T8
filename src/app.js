import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';
//configs
const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;


mongoClient.connect().then(() => {
    db = mongoClient.db("batePapoUol");
})

app.post("/participants", async (req,res) => {
    try{
        let { name } = req.body;
        let time = dayjs().format('HH:mm:ss');
        if(!name || name.length === 0){
            res.sendStatus(402);
            return;
        }

         const already = await db.collection("users").findOne({name});

        if(already){
            res.status(409).send({erro: "Usuário já cadastrado!"});
            return
        }

        await db.collection("users").insertOne({name, lastStatus: Date.now()});

        await db.collection("messages").insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: time});

        res.sendStatus(201)   
    }catch{
        return res.sendStatus(422);
    }
})


app.listen(5001, () => console.log('Ouvindo na porta 5001'))