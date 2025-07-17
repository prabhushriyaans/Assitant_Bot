require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { handleCommand } = require('./chat');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

app.post('/chat', (req, res) => {
    const userInput = req.body.message;
    const result = handleCommand(userInput);
    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
