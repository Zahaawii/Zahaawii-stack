import { CloudClient } from "chromadb";
import { GoogleGeminiEmbeddingFunction } from "@chroma-core/google-gemini";
import { GoogleGenAI } from "@google/genai";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';


//Implemeneting Express to make a controller, so users can give request to the backend.
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.urlencoded({ extended: true }));
app.use(express.static('../'));
app.use(cors());
app.use(express.json());

//Implemeneting the imports and setting them up
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const client = new CloudClient({
  apiKey: process.env.CHROMADB_API_KEY,
  tenant: '37f4ff04-8a40-4a5c-ba87-77b9e4b5d60d',
  database: 'Test'
});


//This function is gemnins api function to embed data to vector
const embedder = new GoogleGeminiEmbeddingFunction({
  apiKey: process.env.GOOGLE_API_KEY,
});

const collection = await client.getOrCreateCollection({
  name: "test_api",
  embeddingFunction: embedder, // <- here we use the google api
})

/*
The section below is where the magic happens.
We have a post controller that takes the users input from our html (via JS fetch) and sends it to the backend, which then sends it back.
It could have been solved with a webclient too, but this works perfect 
*/

let questionAsked = "";


//Global error handling so that if Gemini breaks or something out of our control happens, it will pop up with a customized error
app.use((err, req, res, next) => {
  const status = err.status || 500;

  if (status >= 400 && status < 500) {
    return res.status(status).json({
      message: "Something went wrong! Please try again or wait a few minutes."
    });
  }

  if (status >= 500 && status < 600) {
    return res.status(status).json({
      message: "Something went wrong! Please try again or wait a few minutes."
    });
  }
  res.status(status).json({ message: "Unexpected error." });
});

//Makes the root url be index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'))
});


//Takes the users question from our index.html & browser.js and sends it to the backend
app.post('/api/question', async (req, res, next) => {
  console.log("Entering the POST request");
  questionAsked = req.body.text;
  console.log("POST request generated:");
  console.log(`Question asked: ${questionAsked}`);

  // Control the query result based on the user question with the code down below and then pass it out to gemini
  const results = await collection.query({
    queryTexts: [questionAsked],
    //Choose the result number, std is 10: 
    nResults: 5,
  });

    //Generating the query received from the database and add it to the question asked to the LLM with the context from the database
  try {
  const content = [
    {
      text:
        `Take the giving results from the query and answer questions using text from the reference passage included
        CONTEXT: ${results.documents}
        QUESTION: ${questionAsked}`
    }
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: content,
    config: {
      systemInstruction:
        `
        You are a personal knowledge-base chatbot with the name KnowledgeBot.
        Your sole purpose is to answer questions strictly based on the vector data reported back from the query.
        You must only use information contained in the text from the context result
        
        Rules:
        1. You must only use information contained in the text from the context result or explicitly added knowledge sources.
        2. If a user asks a question not covered by the vector query
        "The answer is not within my current knowledge. Please ask the system administrator to upload a relevant knowledge base article so I can assist you."
        3. You must not generate, assume, infer, or hallucinate any content beyond the user-provided data.
        4. You must not access the internet, external databases, or any pre-trained world knowledge.
        5. You must not alter or reinterpret the uploaded content. Your answers should reflect it faithfully and factually.
        6. Keep answers concise, accurate, and sourced from the documents when possible.

        Goal:
        Act as a controlled retrieval-augmented assistant that provides accurate responses exclusively grounded in the uploaded material. When uncertain, 
        defer to the system administrator for new knowledge uploads.
      `,
      thinkingConfig: {
        thinkingBudget: 0,
      },
    }
  });
  
  res.send(response.text);
  console.log(response.text);
  }
  //Trying to catch errors so the user wont see unnecessary things
  catch(err) {
    console.log("You are in the error catch now: ");
    console.log(err);
    res.send("There has been an error, try again later");
  }
});


app.post('/api/database', async (req, res) => {
  console.log("Inside POST database");
  try {
    await collection.add({
    ids: [req.body.id ],
    documents: [req.body.document],
    metadatas: [req.body.metadata]
  });
  console.log("Collection added");
  res.send(`The KBA has been stored in the database with ${req.body.id}`)
} catch (err) {
    console.error(err);
    res.send("There has been an error with uploading the text. Save the text and refresh the page");
}
})

app.listen(8181, () => {
  console.log('REST API server running on port 8181');
});

