-- init-db.sql
-- Initialize the MediSync database
-- This script runs on first container startup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions (for development)
GRANT ALL PRIVILEGES ON DATABASE medisync TO medisync;
GRANT ALL PRIVILEGES ON SCHEMA public TO medisync;