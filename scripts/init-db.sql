-- init-db.sql
-- Initialize the MediSync database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL PRIVILEGES ON DATABASE medisync TO medisync;
GRANT ALL PRIVILEGES ON SCHEMA public TO medisync;
