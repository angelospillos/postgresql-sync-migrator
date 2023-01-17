# Automatic Daily Export and Import of PostgreSQL Databases using Node.js with Error Handling and Retry Mechanism

This project provides a Node.js script that exports data from one PostgreSQL database and imports it to another, running automatically once a day. It also includes error handling, logging, and a retry mechanism to ensure the reliability of the data transfer. It also has the feature to drop and create target database based on the source database.

## Use Cases

- Automatic Postgres Export Import with Error Handling and Retry using NodeJS
- Daily Postgres Sync with NodeJS Cron Job and Error Handling
- NodeJS based Automatic Postgres Migration with Error Handling and Retry
- Automatic Postgres Backup and Restore with NodeJS Error Handling and Retry

## Features

- Automatic export and import of data from one PostgreSQL database to another
- Scheduling the export/import to run once a day
- Error handling and logging
- Retry mechanism in case of errors
- Drop and create target database based on the source database
- Uses node-cron for scheduling
- Uses pg for connecting to PostgreSQL databases

## Installation

1. Make sure you have Node.js and npm installed on your system. You can download them from the [official website](https://nodejs.org/en/download/)
2. Clone or download the repository
3. Install the dependencies by running `npm install`
4. Set up the environment variables for the source and target databases. You can find the details in the `.env.example` file and rename it to `.env`
5. Run the script using `npm start`

## Usage

The script exports data from the source database and imports it to the target database automatically once a day. You can adjust the schedule by modifying the cron schedule in the script. If errors occur during the export/import process, they will be logged to the console, and the script will retry after 10 seconds.

## Examples
```
Data exported and imported successfully at Mon Jan 17 2022 00:00:00 GMT+0000 (UTC)

```

## Docker

You can build the image by running the following command in the same directory as the Dockerfile:

```
docker build -t mymigrator .
```

Then you can run the container using the following command:

```
docker run -e DATABASE_URL_SOURCE=postgresql://username:password@host:port/database_name -e DATABASE_URL_TARGET=postgresql://username:password@host:port/database_name -e SCHEDULE_TIME=0 0 * * * -e SCHEDULE_TIMEZONE=UTC mymigrator
```

You can build two dummy PostgreSQL to test it

```
docker run --name myPostgresDb1 -p 54551:5432 -e POSTGRES_USER=postgresUser -e POSTGRES_PASSWORD=postgresPW -e POSTGRES_DB=postgresDB -d postgres
```

```
docker run --name myPostgresDb2 -p 54552:5432 -e POSTGRES_USER=postgresUser -e POSTGRES_PASSWORD=postgresPW -e POSTGRES_DB=postgresDB -d postgres
```

And then run the postgres-daily-sync-migrator

```
docker run -e DATABASE_URL_SOURCE=postgresql://postgresUser:postgresPW@localhost:54551/database_name -e DATABASE_URL_TARGET=postgresql://postgresUser:postgresPW@localhost:54552/database_name -e SCHEDULE_TIME=0 0 * * * -e SCHEDULE_TIMEZONE=UTC mymigrator
```

## Troubleshooting

- Make sure that the environment variables are set correctly and the source and target databases are accessible
- Check the error log if the script is not working as expected

## Contribution

If you'd like to contribute to the project, please fork the repository and make changes as you'd like. Pull requests are warmly welcome.

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).

## References

- [node-cron](https://www.npmjs.com/package/node-cron)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [PostgreSQL](https://www.postgresql.org/)

This project is tested and developed on node version 18.12.1 and npm version 8.19.2.
