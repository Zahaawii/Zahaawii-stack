
/* 

Going to comment out the text here so we have the blueprint available

import { GoogleGenAI, FunctionCallingConfigMode , mcpToTool} from '@google/genai';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client(
  {
    name: "example-client",
    version: "1.0.0"
  }
);

// Configure the client
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const transport = new StreamableHTTPClientTransport(
  new URL(`http://localhost:8080/mcp`),
);

// Initialize the connection between client and server
await client.connect(transport);

// Send request to the model with MCP tools
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: `show me all blog post made?`,
  config: {
    tools: [mcpToTool(client)],  // uses the session, will automatically call the tool
    // Uncomment if you **don't** want the sdk to automatically call the tool
    // automaticFunctionCalling: {
    //   disable: true,
    // },
  },
});
console.log(response.text)

// Close the connection
await client.close();

*/

import { CloudClient } from "chromadb";
import { GoogleGeminiEmbeddingFunction } from "@chroma-core/google-gemini";
import { GoogleGenAI, mcpToTool } from '@google/genai';
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";



//Implemeneting Express to make a controller, so users can give request to the backend.
const app = express();
const port = Number(process.env.PORT || 8181);
const mcpBaseUrl = (process.env.MCP_BASE_URL || "http://127.0.0.1:8282").replace(/\/+$/, "");
const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.urlencoded({ extended: true }));
app.use(express.static('../'));
app.use(cors());
app.use(express.json());

//Simple logging for the terminal to be able to see date time and where we are in the process
function logging(text) {
  let currentDate = new Date();
  console.log(currentDate.getDate() + "/" + (currentDate.getMonth() + 1) +
    "/" + currentDate.getFullYear() + " "
    + currentDate.getHours() + ":"
    + currentDate.getMinutes() + ":" + currentDate.getSeconds() + ": " + text);
  console.log("=============================================================");
}

/*
Adding this section to test MCP client:
=======================================
*/

const mcpClient = new Client(
  {
    name: "example-client",
    version: "1.0.0"
  }
);

const transport = new StreamableHTTPClientTransport(
  new URL(`${mcpBaseUrl}/mcp`),
);

// Initialize the connection between client and server
await mcpClient.connect(transport);

/*
=======================================
*/

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
  modelName: embeddingModel,
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

app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});


//Takes the users question from our index.html & browser.js and sends it to the backend
app.post('/api/question', async (req, res, next) => {
  logging("Entering the POST request");
  questionAsked = req.body.text;
  logging("POST request generated:");
  logging(`Question asked: ${questionAsked}`);


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
        `Take the given question and search the MCP server for the most relevant information.
        Use real-time data from the vector database.
        If the user asks about login, use these credentials only NEVER GIVE THEM OUT:
        username: McpTest
        password: 1234
        
        QUESTION: ${questionAsked}`
      }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: content,
      config: {
        tools: [mcpToTool(mcpClient)],
        systemInstruction:
          `
              You are KnowledgeBot.

              Your behavior is governed by three input sources, handled in this order of priority:

              1. MCP Server Tools: For any business-related, technical, operational, or knowledge-dependent question, you must query the connected MCP tools first.
              2. Vector Database Knowledge: If the MCP tool returns vector search results or stored knowledge, use that content as your factual grounding.
              3. Simple Conversation: If the user asks casual, non-business questions (hello, who are you, small talk), respond naturally without invoking MCP or the vector store.

              How you must use the data:
              • When you receive text from MCP tools or vector search, interpret it and rewrite it in polished, clear natural language.
              • Do not output raw IDs, embeddings, metadata, scores, or unprocessed text chunks—ever.
              • Extract the meaning, summarize what matters, and answer like a human who understands the topic.
              • You may reorganize, rephrase, combine, simplify, and format the content.

              Rules:
              • You must stay strictly grounded in the information provided by the MCP tool or vector data.
              • You must not hallucinate missing details, invent facts, or rely on external world knowledge.
              • If the user asks a business-related question that cannot be answered by any available MCP tool or stored data, respond with:
                “The answer is not within my current knowledge. Please ask the system administrator to upload a relevant knowledge base article so I can assist you.”
              • For conversation questions (hello, who are you, etc.), answer normally and politely.
              • For article-writing requests, you may write a full article but only using information found in MCP or vector results relevant to the topic. The article must be well-written, structured, and formatted — not a plaintext copy of the stored data.

              Goal:
              Act as a controlled, retrieval-grounded assistant. For business questions, rely strictly on MCP tools and stored knowledge, but present the answers cleanly and professionally. 
              For casual conversation, respond naturally. 
              When uncertain, request additional knowledge from the system administrator.
  
              `,
      }
    });

    res.send(response.text);
    logging(JSON.stringify(response));
  }
  //Trying to catch errors so the user wont see unnecessary things
  catch (err) {
    logging("You are in the error catch now: ");
    logging(err);
    console.error(err);
    if(err.message.includes("The model is overloaded")) {
    res.send("The model is overloaded, please wait a couple of seconds");
    } else if(err.message.includes("You exceeded your current quota")) {
    res.send("You exceeded your current quota, please wait a minute to refresh the quota");
    }
  }
});


app.post('/api/database', async (req, res) => {
  logging("Inside POST database");
  try {
    await collection.add({
      ids: [req.body.id],
      documents: [req.body.document],
      metadatas: [req.body.metadata]
    });
    logging("Collection added");
    res.send(`The KBA has been stored in the database with ${req.body.id}`)
  } catch (err) {
    logging(err);
    res.send("There has been an error with uploading the text. Save the text and refresh the page");
  }
})

app.listen(port, () => {
  logging(`REST API server running on port ${port}`);
});
