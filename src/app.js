import express from 'express';
import cors from 'cors';
//configs
const app = express();
app.use(cors());
app.use(express.json());




app.listen(5001, () => console.log('Ouvindo na porta 5001'))