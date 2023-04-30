const axios = require('axios');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });

// Define image schema and model
const imageSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  filename: { type: String, required: true }
});
const Image = mongoose.model('Image', imageSchema);

// Configure OpenAI API
const { Configuration, OpenAIApi } = require("openai");
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
  }).then(function(response) {
    response.data.pipe(writer);
  });

  // Save image metadata to MongoDB
  const image = new Image({ prompt, filename });
  await image.save();

  return filename;
}

// Define Express routes
app.use(express.json());
app.use(express.static('public'));

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

// Start server
app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
