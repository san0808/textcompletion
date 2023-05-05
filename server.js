const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const { Readable } = require('stream');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });

// Define image schema and model
const imageSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  imageData: { type: Buffer, required: true },
  contentType: { type: String, required: true }
});
const Image = mongoose.model('Image', imageSchema);

// Configure OpenAI API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Generate image and save to MongoDB
async function generateImage(prompt) {
  // Call OpenAI API to generate image
  const response = await openai.createImage({
    prompt: prompt,
    n: 1,
    size: "256x256",
  });

  // Download the image and store it as a buffer
  const imageData = await axios.get(response.data.data[0].url, {
    responseType: 'arraybuffer'
  }).then(response => response.data);

  // Create a readable stream from the buffer
  const readableImageStream = new Readable();
  readableImageStream.push(imageData);
  readableImageStream.push(null);

  // Save image metadata and buffer to MongoDB
  const image = new Image({
    prompt,
    imageData,
    contentType: 'image/jpeg' // set the content type of the image here
  });
  await image.save();

  return image._id;
}

// Add middleware for handling JSON requests
app.use(express.json());

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
  const imageId = await generateImage(prompt);

  res.json({ imageId });
});

app.get('/images/:id', async (req, res) => {
  const id = req.params.id;

  // Find the image by id in the database
  const image = await Image.findById(id).exec();
  if (!image) {
    res.status(404).send('Image not found');
    return;
  }

  // Set the content type of the response
  res.setHeader('Content-Type', image.contentType);

  // Create a readable stream from the buffer and pipe it to the response
  const readableImageStream = new Readable();
  readableImageStream.push(image.imageData);
  readableImageStream.push(null);
  readableImageStream.pipe(res);
});

app.get('/images', async (req, res) => {
  const images = await Image.find().select('-__v -imageData').exec();
  res.json(images);
});


app.get('/suggestion', async (req, res) => {
  try {
    const completion = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt:
        'Write a random text prompt for DALL·E to generate an image, this prompt will be shown to the user, include details such as the genre and what type of painting it should be, options can include: oil painting, watercolor, photo-realistic, 4k, abstract, modern, black and white etc. Do not wrap the answer in quotes.',
    });
    const suggestion = completion.data.choices[0].text;
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
