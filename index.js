require('dotenv').config();
const { Client } = require('pg');
const cron = require('node-cron');

// Connection details for source and target databases
const source = {
  user: process.env.SOURCE_DB_USER,
  host: process.env.SOURCE_DB_HOST,
  database: process.env.SOURCE_DB_NAME,
  password: process.env.SOURCE_DB_PASSWORD,
  port: process.env.SOURCE_DB_PORT,
};

const target = {
  user: process.env.TARGET_DB_USER,
  host: process.env.TARGET_DB_HOST,
  password: process.env.TARGET_DB_PASSWORD,
  port: process.env.TARGET_DB_PORT,
};

let tables = [];

// Connect to the source database and get the list of tables
const getTables = async () => {
  const sourceClient = new Client(source);
  await sourceClient.connect();
  const sourceRes = await sourceClient.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'');
  await sourceClient.end();
  return sourceRes.rows.map(x=>x.table_name);
};

// Connect to the target database and drop it
const dropTargetDb = async () => {
  const targetClient = new Client(target);
  await targetClient.connect();
  await targetClient.query(`DROP DATABASE ${process.env.TARGET_DB_NAME}`);
  await targetClient.end();
};

// Connect to the target database and create it
const createTargetDb = async () => {
  const targetClient = new Client(target);
  await targetClient.connect();
  await targetClient.query(`CREATE DATABASE ${process.env.TARGET_DB_NAME}`);
  await targetClient.end();
};

// Connect to the source database and export the data
const exportData = async () => {
  const sourceClient = new Client(source);
  await sourceClient.connect();
  const tables = await getTables();
  let sourceRes = {};
  tables.forEach(async (table)=>{
    sourceRes[table] = await sourceClient.query(`SELECT * FROM ${table}`);
  });
  await sourceClient.end();
  return sourceRes;
};

// Connect to the target database and import the data
const importData = async (data) => {
  const targetClient = new Client({...target,database:process.env.TARGET_DB_NAME});
  await targetClient.connect();
  tables.forEach(async (table)=>{
    await targetClient.query(`CREATE TABLE ${table} AS SELECT * FROM ${process.env.SOURCE_DB_NAME}.${table}`);
  });
  await targetClient.end();
};

// Schedule the export and import
const scheduleExportImport = async () => {
  try {
    await dropTargetDb();
    await createTargetDb();
    const data = await exportData();
    await importData(data);
    console.log(`Data exported and imported successfully at ${new Date()}`);
  } catch (err) {
    console.error(`Error occured while exporting and importing data: ${err}`);
    console.error(`Error occured while exporting and importing data at ${new Date()} : ${err}`);
    setTimeout(scheduleExportImport, 10000);
  }
}

// Run the export and import every day at 12:00 AM
cron.schedule('0 0 * * *', scheduleExportImport);
