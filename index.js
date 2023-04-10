const express = require('express');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001') // replace with the domain of your app
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  next()
})

app.get('/', async (req, res) => {
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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
