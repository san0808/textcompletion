const axios = require('axios');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
console.log(process.env.OPENAI_API_KEY)
// 1. Set up dependencies and environment
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });

const imageSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  filename: { type: String, required: true }
});

const Image = mongoose.model('Image', imageSchema);

// 2. Image generation function
async function generateImage(prompt) {
  const response = await axios.post('https://api.openai.com/v1/images/generations/dall-e', {
    model: 'image-alpha-001',
    prompt: prompt,
    response_format: 'url',
    size: '256x256',
    num_images: 1,
    size_variation: 0.5,
    brightness: 0.5,
    contrast: 1.0,
    format: 'jpg'
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    }
  });

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

  const image = new Image({ prompt, filename });
  await image.save();

  return filename;
}

// 3. Set up routes
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

// 4. Start server
app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
