const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });

// Define image schema and model
const imageSchema = new mongoose.Schema({
    prompt: { type: String, required: true },
    filename: { type: String, required: true }
});
const Image = mongoose.model('Image', imageSchema);

// Configure OpenAI API
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Generate image and save to MongoDB and file system
async function generateImage(prompt) {
    // Call OpenAI API to generate image
    const response = await openai.createImage({
        prompt: prompt,
        n: 1,
        size: "256x256",
    });

    // Download the image and save to file system
    const filename = `image-${Date.now()}.jpg`;
    const path = `./public/images/${filename}`;
    const writer = fs.createWriteStream(path);

    axios({
        method: 'get',
        url: response.data.data[0].url,
        responseType: 'stream'
    }).then(function (response) {
        response.data.pipe(writer);
    });

    // Save image metadata to MongoDB
    const image = new Image({ prompt, filename });
    await image.save();

    return filename;
}

// Add middleware for handling JSON requests
app.use(express.json());

// Serve static files from the public folder
app.use(express.static('public'));

// Add Access-Control-Allow-Origin header to responses
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001'); // replace with the domain of your app
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Define routes
app.post('/generate-image', async (req, res) => {
    const prompt = req.body.prompt;
    const filename = await generateImage(prompt);

    res.json({ filename });
});

app.get('/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const path = `./public/images/${filename}`;

    fs.readFile(path, (err, data) => {
        if (err) {
            res.status(404).send('File not found');
        } else {
            res.setHeader('Content-Type', 'image/jpeg');
            res.send(data);
        }
    });
});

app.get('/images', async (req, res) => {
    const images = await Image.find().select('-__v').exec();
    res.json(images);
});

app.get('/suggestion', async (req, res) => {
    try {
      const completion = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt:
          'Write a random text prompt for DALL·E to generate an image, this prompt will be shown to the user, include details such as the genre and what type of painting it should be, options can include: oil painting, watercolor, photo-realistic, 4k, abstract, modern, black and white etc. Do not wrap the answer in quotes.',
      });
      suggestion=completion.data.choices[0].text;
      res.send(suggestion);
  
    } catch (error) {
      console.log(error);
      res.status(500).send('Something went wrong!');
    }
  });
// Start the server
app.listen(port, () => {
    console.log(`Server listening on port ${ port }`);
});
