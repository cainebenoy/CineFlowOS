package database

import (
	"context"
	"fmt"
)

// InitSchema creates the foundational tables if they do not exist.
func (db *DB) InitSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS projects (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		title VARCHAR(255) NOT NULL,
		project_type VARCHAR(50) NOT NULL,
		status VARCHAR(50) DEFAULT 'active',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS scenes (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		scene_number VARCHAR(50) NOT NULL,
		setting VARCHAR(50),
		time_of_day VARCHAR(50),
		page_eighths INT,
		summary TEXT
	);

	CREATE TABLE IF NOT EXISTS breakdown_elements (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		category VARCHAR(50) NOT NULL,
		name VARCHAR(255) NOT NULL,
		estimated_cost DECIMAL(12,2) DEFAULT 0.00,
		actual_cost DECIMAL(12,2) DEFAULT 0.00,
		CONSTRAINT unique_project_element UNIQUE (project_id, category, name)
	);

	CREATE TABLE IF NOT EXISTS scene_elements (
		scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
		element_id UUID REFERENCES breakdown_elements(id) ON DELETE CASCADE,
		PRIMARY KEY (scene_id, element_id)
	);

	CREATE TABLE IF NOT EXISTS shoot_days (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		day_number INT NOT NULL,
		shoot_date DATE,
		status VARCHAR(50) DEFAULT 'draft'
	);

	CREATE TABLE IF NOT EXISTS scheduled_scenes (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		shoot_day_id UUID REFERENCES shoot_days(id) ON DELETE SET NULL,
		scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
		sort_order INT NOT NULL,
		estimated_minutes INT DEFAULT 0,
		CONSTRAINT unique_scheduled_scene UNIQUE (scene_id)
	);

	DROP TABLE IF EXISTS takes CASCADE;
	CREATE TABLE IF NOT EXISTS takes (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
		take_number INT NOT NULL,
		lens VARCHAR(50),
		duration_seconds INT,
		is_circled BOOLEAN DEFAULT FALSE,
		supervisor_notes TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		CONSTRAINT unique_scene_take UNIQUE (scene_id, take_number)
	);

	CREATE TABLE IF NOT EXISTS crew_members (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		name VARCHAR(255) NOT NULL,
		role VARCHAR(100) NOT NULL,
		phone_number VARCHAR(20) NOT NULL,
		is_active BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		CONSTRAINT unique_crew_member UNIQUE (project_id, phone_number)
	);

	INSERT INTO crew_members (project_id, name, role, phone_number) 
	VALUES 
		('85bf2069-e3fe-40e8-8739-8ad1cbeebf87', 'Adhityan', 'Director of Photography', '+919876543210'),
		('85bf2069-e3fe-40e8-8739-8ad1cbeebf87', 'Mohamed', 'Gaffer', '+919876543211'),
		('85bf2069-e3fe-40e8-8739-8ad1cbeebf87', 'Cyril', 'Transport Coordinator', '+919876543212')
	ON CONFLICT (project_id, phone_number) DO NOTHING;

	ALTER TABLE breakdown_elements ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(12,2) DEFAULT 0.00;
	ALTER TABLE breakdown_elements ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(12,2) DEFAULT 0.00;

	-- 1. Create the Audit Table
	CREATE TABLE IF NOT EXISTS system_audit_logs (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		table_name VARCHAR(50) NOT NULL,
		action VARCHAR(10) NOT NULL,
		record_id UUID NOT NULL,
		old_data JSONB,
		new_data JSONB,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- 2. Create the Trigger Function
	CREATE OR REPLACE FUNCTION audit_financials_func() RETURNS trigger AS $$
	BEGIN
		IF TG_OP = 'UPDATE' THEN
			-- Only log if the financial numbers actually changed
			IF OLD.estimated_cost IS DISTINCT FROM NEW.estimated_cost OR OLD.actual_cost IS DISTINCT FROM NEW.actual_cost THEN
				INSERT INTO system_audit_logs (project_id, table_name, action, record_id, old_data, new_data)
				VALUES (NEW.project_id, TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(OLD), row_to_json(NEW));
			END IF;
			RETURN NEW;
		END IF;
		RETURN NULL;
	END;
	$$ LANGUAGE plpgsql;

	-- 3. Attach the Trigger to the Budget Elements
	DROP TRIGGER IF EXISTS audit_budget_trigger ON breakdown_elements;
	CREATE TRIGGER audit_budget_trigger
	AFTER UPDATE ON breakdown_elements
	FOR EACH ROW EXECUTE FUNCTION audit_financials_func();

	-- Crew & Payroll Engine: Upgrade crew_members with payroll fields
	ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10,2) DEFAULT 0.00;
	ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100);
	ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS pan_number VARCHAR(10);

	-- Attendance Ledger: Tracks daily geo-fenced punches
	CREATE TABLE IF NOT EXISTS attendance_logs (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
		crew_id UUID REFERENCES crew_members(id) ON DELETE CASCADE,
		check_in_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		latitude DECIMAL(10,8),
		longitude DECIMAL(11,8),
		status VARCHAR(20) DEFAULT 'Present'
	);

	-- Prevent double clock-ins on the same calendar day per crew member
	CREATE UNIQUE INDEX IF NOT EXISTS unique_daily_checkin
	ON attendance_logs (crew_id, (check_in_time::DATE));
	`

	_, err := db.Pool.Exec(context.Background(), schema)
	if err != nil {
		return fmt.Errorf("failed to execute schema: %v", err)
	}

	fmt.Println("Database schema initialized successfully.")
	return nil
}