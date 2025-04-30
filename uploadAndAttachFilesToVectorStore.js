//===Import the OpenAI library and configure it with your API key.

require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const { logger, } = require('./logger');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

//===Use uploadAndPoll for batch operations.

async function uploadFilesToVectorStore(vectorStoreId, fileNames) {
  try {
 
    if (fileNames.length <= 0) {
      //logger.info('Skip all files.');
      return;
    }

    //Before uploading updated files to Vector Store, delete them first

    const toBeDeletedList = [];
    const list = await openai.files.list();

    for await (const file of list) {
      if (fileNames.includes(file.filename)) {
        toBeDeletedList.push(file.id);
      }
    }

    for await (const fileId of toBeDeletedList) {
      await openai.files.del(fileId);
      //console.log(`Deleted file with ID: ${fileId}`);
    }

    //Upload updated files

    const files = fileNames.map((fileName) => fs.createReadStream(process.env.mdFolder + "/" + fileName));

    const response = await openai.vectorStores.fileBatches.uploadAndPoll(vectorStoreId, { //openai.beta.vectorStores does not work
      files: files,
    });

    const numArticleUpdate = toBeDeletedList.length;
    const numArticleNew = fileNames.length - numArticleUpdate;
    logger.info(`${numArticleNew} new articles. ${numArticleUpdate} updated articles`);

    return response;
    
  } catch (error) {
    console.error('Error uploading files to vector store:', error);
    throw error;
  }

}

//===============================

module.exports = {
  uploadFilesToVectorStore: uploadFilesToVectorStore,
};