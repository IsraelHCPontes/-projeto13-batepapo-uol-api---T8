import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
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

//Configs
const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

try{
    await mongoClient.connect();
    db =  mongoClient.db("batePapoUol");
}catch(err){
    console.log(err);
}

app.post("/participants", async (req,res) => {
    let user = req.body;
    let time = dayjs().format('HH:mm:ss');
    const validation = userSchema.validate(user,{abortEarly: false});
    
    if(validation.error){
        const erros = validation.error.details.map(detail => detail.message);
        return res.status(422).send(erros);
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

        res.sendStatus(201);   
    }catch(err){
        return res.status(422).send(err);
    }
})

app.get("/participants", async (req, res) =>{
    try{
        const users = await db.collection('users').find().toArray();
        return res.send(users);
    }catch(err){
        return res.send(err);
    }
})

app.post("/messages", async(req, res) => {
    const { to, text, type }= req.body;
    const {user} = req.headers;
    let time = dayjs().format('HH.mm.ss');
    const message = {  
        from: user,
        to,
        text,
        type,
        time};
    
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
});

app.get("/messages", async (req, res) => {
    const limit  = parseInt(req.query.limit);
    const {user} = req.headers;
   
    try {
    const messages = await db.collection('messages').find().toArray();
    const filtradas = messages.filter(message =>{
        const {from, to, type} = message;
        if(from === user || to === user || to === 'Todos' || type === 'message'){
            return true;
        }})

    if(limit){
        return res.send(filtradas.slice(-limit));
    }    

    res.send(filtradas);

   }catch(err){
    res.status(500).send(err.message);
   }
});

app.post("/status", async (req, res) => {
    const {user} = req.headers;
    
    try{
        const already = await db.collection('users').findOne({name:user});
       
        if(!already){
            return res.sendStatus(404);
        }

        await db.collection('users').updateOne({name: user}, {$set:{lastStatus: Date.now()}})

        res.sendStatus(200);
    }catch(err){
        res.sendStatus(500);
    }
});

app.delete("/messages/:id", async (req, res) =>{
    const {user} = req.headers;
    const {id} = req.params;

    try{
        const already = await db.collection('messages').findOne({_id: ObjectId(id)});
        if(!already){
            return res.sendStatus(404);
        }
        if(already.from !== user){
            return res.send(401);
        }
        
        await db.collection('messages').deleteOne({_id: ObjectId(already._id)});

        res.sendStatus(200);
    }catch(err){
        res.send({error: err});
    }
});

app.put("/messages/:id", async (req, res) => {
    const { to, text, type }= req.body;
    const {user} = req.headers;
    const {id} = req.params;
    let time = dayjs().format('HH.mm.ss');
    const message = {  
        from: user,
        to,
        text,
        type,
        time
    };

        const validation = messageSchema.validate(message, {abortEarly: false});

        if(validation.error){
            return res.status(422).send(validation.error.details);
        }

        try{
            const already = await db.collection('users').findOne({name: user});
            const idAlready = await db.collection('messages').findOne({_id: ObjectId(id)});

            if(!already){
                return res.status(422).send(user);
            }

            if(!idAlready){
                return res.sendStatus(404);
            }

            if(idAlready.from !== user){
                return res.sendStatus(401);
            }

            await db.collection('messages').updateOne({_id: ObjectId(idAlready._id)}, {$set:message});

            res.sendStatus(201);
             
        }catch(err){
            res.status(500).send('érro aqui');
        }
});

setInterval( async () =>{
    const timeLimit = Date.now() - 10 * 1000;
    const time = dayjs().format('HH:mm:ss');

    try{
        const participants = await db.collection('users').find().toArray();

        const absent = participants.filter(({lastStatus}) => lastStatus < timeLimit);

        if(absent.length > 0){
            absent.forEach(async({name}) => {
                const message = {
                         from: name,
                         to: 'Todos',
                         text: 'sai da sala...',
                         type: 'status',
                         time};

                await db.collection('users').deleteOne({name});

                await db.collection('messages').insertOne(message);   
            })
        }
    }catch(err){
        res.status(500).send({error: err });
    }
}, 15000)//LEMBRAR DE VOLTAR PRA 15SEG

app.listen(process.env.PORT, () =>
 console.log(`Ouvindo na porta: ${process.env.PORT}`));