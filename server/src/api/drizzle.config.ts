import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "postgresql",
    schema: "src/api/db/schema.ts",
    out: "./src/api/db/drizzle",
    dbCredentials: {
        host: "127.0.0.1",
        user: "survev",
        password: "survev",
        database: "survev",
        port: 5432,
        ssl: false,
    },
});
