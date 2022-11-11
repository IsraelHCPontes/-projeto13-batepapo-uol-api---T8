import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';
import joi from 'joi';

//Schemas
const userSchema = joi.object({
    name: joi.string().required()
})

const messageSchema = joi.object({
    from: joi.string().required(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
    time: joi.string().required()
})



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
    let user = req.body;
    let time = dayjs().format('HH:mm:ss');
    const validation = userSchema.validate(user,{abortEarly: false});
    
    if(validation.error){
        const erros = validation.error.details.map(detail => detail.message)
        return res.status(422).send(erros)
    }

    try{
         const already = await db.collection("users").findOne({name:user.name});

        if(already){
            res.status(409).send({erro: "Usuário já cadastrado!"});
            return
        }

        await db.collection("users").insertOne({
            name:user.name,
            lastStatus: Date.now()});

        await db.collection("messages").insertOne({
            from: user.name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: time});

        res.sendStatus(201)   
    }catch(err){
        return res.status(422).send(err);
    }
})

app.get("/participants", async (req, res) =>{
    try{
        const users = await db.collection('users').find().toArray();
        return res.send(users)
    }catch(err){
        return res.send(err);
    }
})

app.post("/messages", async(req, res) => {
    const { to, text, type }= req.body;
    const {user} = req.headers;
    let time = dayjs().format('HH.mm.ss')
    const message = {  
        from: user,
        to,
        text,
        type,
        time}
    
    const validation = messageSchema.validate(message, {abortEarly: false});

    if(validation.error){
        const erros = validation.error.details.map(detail => detail.message);
        return res.status(422).send(erros)
    }

    try{
       const already = await db.collection('users').findOne({name:user});
       
       if(!already){
        return res.status(422).send({error:"Participante não cadastrado"})
       }

       await db.collection('messages').insertOne(message);

        return res.sendStatus(201);
    }catch(err){
        return res.status(422).send(err);
    }
})

app.get("/messages", async (req, res) => {
   try {
    const limit  = parseInt(req.query.limit);
    const {user} = req.headers;
    const messages = await db.collection('messages').find().toArray();
    const filtradas = messages.filter(message =>{
        const {from, to, type} = message;
        const toUser = from === user || to === user || to === 'todos';
        const publicS = type === 'message'
        return toUser || publicS;})

    if(limit){
        return res.send(filtradas.slice(-limit));
    }    

    res.send(filtradas);

   }catch(err){
    res.status(500).send(err.message);
   }
})

app.listen(5001, () => console.log('Ouvindo na porta 5001'))